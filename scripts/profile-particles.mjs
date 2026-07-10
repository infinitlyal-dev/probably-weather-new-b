import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'dist');
const DEFAULT_DURATION_MS = 30000;
const DEFAULT_CPU_THROTTLE = 6;
const FRAME_BUDGET_MS = 1000 / 60;

function percentile(sorted, fraction) {
  if (!sorted.length) return null;
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}

export function summarizeFrameIntervals(intervals) {
  const values = intervals.filter(Number.isFinite);
  const sorted = [...values].sort((a, b) => a - b);
  const estimatedDroppedFrames = values.reduce(
    (total, ms) => total + Math.max(0, Math.round(ms / FRAME_BUDGET_MS) - 1),
    0,
  );
  const missed = values.filter((ms) => ms > FRAME_BUDGET_MS * 1.25).length;
  const elapsedMs = values.reduce((total, ms) => total + ms, 0);
  return {
    samples: values.length,
    meanMs: values.length ? elapsedMs / values.length : null,
    p50Ms: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    p99Ms: percentile(sorted, 0.99),
    maxMs: sorted.at(-1) ?? null,
    observedFps: elapsedMs > 0 ? values.length / (elapsedMs / 1000) : null,
    deadlineMissPct: values.length ? (missed / values.length) * 100 : null,
    estimatedDroppedFrames,
    estimatedDroppedFramePct: values.length
      ? (estimatedDroppedFrames / (values.length + estimatedDroppedFrames)) * 100
      : null,
  };
}

function weatherPayload(condition) {
  const storm = condition === 'storm';
  const rainChance = storm ? 90 : 75;
  const label = storm ? 'Thunderstorms' : 'Rain';
  const hourly = Array.from({ length: 48 }, () => ({
    tempC: 18,
    feelsLikeC: 17,
    rainChance,
    precipMm: storm ? 4 : 2,
    windKph: storm ? 38 : 22,
    cloudPct: 95,
    humidity: 88,
    uv: 1,
    condition,
  }));
  const daily = Array.from({ length: 7 }, () => ({
    highC: 20,
    lowC: 14,
    rainChance,
    uv: 2,
    windKph: storm ? 38 : 22,
    conditionKey: condition,
    conditionLabel: label,
    sunrise: '2026-07-10T07:45',
    sunset: '2026-07-10T17:55',
  }));
  return {
    ok: true,
    location: { name: 'Strand, Western Cape', lat: -34.12, lon: 18.84 },
    now: {
      tempC: 18,
      feelsLikeC: 17,
      rainChance,
      uv: 1,
      isDay: true,
      sunrise: '2026-07-10T07:45',
      sunset: '2026-07-10T17:55',
      windKph: storm ? 38 : 22,
      cloudPct: 95,
      conditionKey: condition,
      conditionLabel: label,
    },
    hourly,
    daily,
    wind_kph: storm ? 38 : 22,
    maxWindKph: storm ? 50 : 30,
    gustKph: storm ? 58 : 34,
    consensus: { confidenceKey: 'high' },
    meta: {
      localHour: 14,
      utcOffsetSeconds: 7200,
      confidence: 'high',
      sources: [{ name: 'Open-Meteo', ok: true }, { name: 'WeatherAPI', ok: true }],
      sourceConditions: [
        { source: 'Open-Meteo', vote: storm ? 'storm' : 'rain', desc: label },
        { source: 'WeatherAPI', vote: storm ? 'storm' : 'rain', desc: label },
      ],
      sourceRanges: [],
    },
  };
}

function startStaticServer() {
  const mime = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
  };
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname === '/install' ? 'install.html' : pathname.slice(1);
    const file = path.resolve(dist, relative);
    if (!file.startsWith(`${dist}${path.sep}`) && file !== path.join(dist, 'index.html')) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    try {
      const body = readFileSync(file);
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('Not found');
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({
      server,
      origin: `http://127.0.0.1:${server.address().port}`,
    }));
  });
}

async function readTrace(client, stream) {
  const chunks = [];
  while (true) {
    const part = await client.send('IO.read', { handle: stream });
    chunks.push(part.base64Encoded ? Buffer.from(part.data, 'base64') : Buffer.from(part.data));
    if (part.eof) break;
  }
  await client.send('IO.close', { handle: stream });
  return Buffer.concat(chunks);
}

function metricsMap(result) {
  return Object.fromEntries(result.metrics.map(({ name, value }) => [name, value]));
}

function metricDelta(before, after, name) {
  return (after[name] ?? 0) - (before[name] ?? 0);
}

function traceTaskSummary(traceBuffer) {
  const trace = JSON.parse(traceBuffer.toString('utf8'));
  const mainThread = trace.traceEvents.find(
    (event) => event.ph === 'M' && event.name === 'thread_name' && event.args?.name === 'CrRendererMain',
  );
  if (!mainThread) return { beginMainFrameTimeMs: null, longFrames: null, longestMainFrameMs: null };
  const frames = trace.traceEvents.filter((event) => (
    event.ph === 'X'
    && event.pid === mainThread.pid
    && event.tid === mainThread.tid
    && event.name === 'WebFrameWidgetImpl::BeginMainFrame'
    && Number.isFinite(event.dur)
  ));
  const durations = frames.map((event) => event.dur / 1000);
  return {
    beginMainFrameTimeMs: durations.reduce((total, value) => total + value, 0),
    longFrames: durations.filter((value) => value > 50).length,
    longestMainFrameMs: durations.length ? Math.max(...durations) : 0,
  };
}

async function profileCondition(browser, origin, condition, particlesEnabled, trial, durationMs, cpuThrottle, traceDir) {
  const context = await browser.newContext({
    viewport: { width: 400, height: 800 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'no-preference',
    serviceWorkers: 'block',
  });
  await context.addInitScript(() => {
    try {
      localStorage.setItem('pw_home', JSON.stringify({
        name: 'Strand, Western Cape', lat: -34.12, lon: 18.84, mode: 'gps',
      }));
    } catch {}
  });
  await context.route('**/_vercel/**', (route) => route.abort());
  await context.route('**/api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/weather') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(weatherPayload(condition)) });
    } else if (pathname === '/api/locate') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, lat: -34.12, lon: 18.84, name: 'Strand, Western Cape' }) });
    } else if (pathname === '/api/version') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ buildId: 'local' }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
  });

  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottle });
  await client.send('Performance.enable');
  await client.send('DOM.enable');
  let layers = [];
  client.on('LayerTree.layerTreeDidChange', (event) => { layers = event.layers || layers; });
  await client.send('LayerTree.enable');

  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    (expected) => window.__PW_FIRST_RENDER === true && window.__PW_LAST_DISPLAY === expected,
    condition,
    { timeout: 15000 },
  );
  await page.waitForFunction(() => document.querySelectorAll('#particles .particle.rain').length === 28);
  await page.waitForTimeout(2000);
  if (!particlesEnabled) {
    await page.evaluate(() => document.getElementById('particles')?.replaceChildren());
    await page.waitForTimeout(500);
  }

  await page.evaluate(() => {
    window.__p10LongTasks = [];
    if ('PerformanceObserver' in window) {
      new PerformanceObserver((list) => {
        window.__p10LongTasks.push(...list.getEntries().map((entry) => entry.duration));
      }).observe({ type: 'longtask' });
    }
  });

  const before = metricsMap(await client.send('Performance.getMetrics'));
  const tracingComplete = new Promise((resolve) => client.once('Tracing.tracingComplete', resolve));
  await client.send('Tracing.start', {
    categories: 'devtools.timeline,blink,cc,benchmark,disabled-by-default-devtools.timeline.frame',
    transferMode: 'ReturnAsStream',
  });

  const intervals = await page.evaluate((runMs) => new Promise((resolve) => {
    const samples = [];
    const started = performance.now();
    let previous = null;
    const tick = (now) => {
      if (previous !== null) samples.push(now - previous);
      previous = now;
      if (now - started < runMs) requestAnimationFrame(tick);
      else resolve(samples);
    };
    requestAnimationFrame(tick);
  }), durationMs);

  await client.send('Tracing.end');
  const { stream } = await tracingComplete;
  const traceBuffer = await readTrace(client, stream);
  const after = metricsMap(await client.send('Performance.getMetrics'));
  const pageLongTasks = await page.evaluate(() => window.__p10LongTasks || []);
  const particleCount = await page.locator('#particles .particle.rain').count();
  const frame = summarizeFrameIntervals(intervals);
  const traceTasks = traceTaskSummary(traceBuffer);
  const particleLayers = [];
  for (const layer of layers) {
    if (!layer.backendNodeId) continue;
    try {
      const { node } = await client.send('DOM.describeNode', { backendNodeId: layer.backendNodeId, depth: 0 });
      const attributes = Object.fromEntries(Array.from({ length: (node.attributes || []).length / 2 }, (_, index) => (
        [node.attributes[index * 2], node.attributes[index * 2 + 1]]
      )));
      if ((attributes.class || '').split(/\s+/).includes('particle')) particleLayers.push(layer);
    } catch { /* Layer may disappear between snapshot and node lookup. */ }
  }
  const estimatedLayerSurfaceBytes = layers.reduce(
    (total, layer) => total + (layer.drawsContent ? layer.width * layer.height * 4 * 4 : 0),
    0,
  );
  const estimatedParticleLayerSurfaceBytes = particleLayers.reduce(
    (total, layer) => total + (layer.width * layer.height * 4 * 4),
    0,
  );

  mkdirSync(traceDir, { recursive: true });
  const mode = particlesEnabled ? 'particles' : 'control';
  const traceFile = path.join(traceDir, `p10-${condition}-${mode}-trial${trial}-${cpuThrottle}x-${durationMs}ms.trace.json.gz`);
  writeFileSync(traceFile, gzipSync(traceBuffer));
  await context.close();

  return {
    condition,
    mode,
    trial,
    durationMs,
    cpuThrottle,
    viewport: '400x800@2x',
    particleCount,
    frames: frame,
    mainThread: {
      taskDurationMs: metricDelta(before, after, 'TaskDuration') * 1000,
      taskPct: (metricDelta(before, after, 'TaskDuration') * 1000 / durationMs) * 100,
      scriptDurationMs: metricDelta(before, after, 'ScriptDuration') * 1000,
      layoutDurationMs: metricDelta(before, after, 'LayoutDuration') * 1000,
      recalcStyleDurationMs: metricDelta(before, after, 'RecalcStyleDuration') * 1000,
      longTasksFromObserver: pageLongTasks.length,
      longestObserverTaskMs: pageLongTasks.length ? Math.max(...pageLongTasks) : 0,
      trace: traceTasks,
    },
    layers: {
      count: layers.length,
      drawsContent: layers.filter((layer) => layer.drawsContent).length,
      memoryBytes: null,
      memoryUnavailableReason: 'Chrome DevTools LayerTree exposes geometry, not compositor backing-store memory.',
      estimatedSurfaceBytesUpperBound: estimatedLayerSurfaceBytes,
      particleLayerCount: particleLayers.length,
      estimatedParticleSurfaceBytesUpperBound: estimatedParticleLayerSurfaceBytes,
      estimateBasis: 'sum(drawsContent layer CSS width × height × 4 bytes × deviceScaleFactor²)',
    },
    jsHeap: {
      usedBytesEnd: after.JSHeapUsedSize ?? null,
      totalBytesEnd: after.JSHeapTotalSize ?? null,
    },
    traceFile: path.relative(root, traceFile).replaceAll('\\', '/'),
    traceCompressedBytes: statSafe(traceFile),
  };
}

function statSafe(file) {
  try { return readFileSync(file).length; } catch { return null; }
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function aggregateProfiles(profiles, condition, mode) {
  const selected = profiles.filter((profile) => profile.condition === condition && profile.mode === mode);
  return {
    trials: selected.length,
    observedFpsMedian: median(selected.map((profile) => profile.frames.observedFps)),
    p95FrameMsMedian: median(selected.map((profile) => profile.frames.p95Ms)),
    estimatedDroppedFramePctMedian: median(selected.map((profile) => profile.frames.estimatedDroppedFramePct)),
    mainThreadTaskPctMedian: median(selected.map((profile) => profile.mainThread.taskPct)),
    recalcStyleDurationMsMedian: median(selected.map((profile) => profile.mainThread.recalcStyleDurationMs)),
    longTasksTotal: selected.reduce((total, profile) => total + profile.mainThread.longTasksFromObserver, 0),
    particleLayerCountMedian: median(selected.map((profile) => profile.layers.particleLayerCount)),
    estimatedParticleSurfaceBytesUpperBoundMedian: median(
      selected.map((profile) => profile.layers.estimatedParticleSurfaceBytesUpperBound),
    ),
  };
}

async function main() {
  const durationMs = Number(process.env.PW_PROFILE_DURATION_MS || DEFAULT_DURATION_MS);
  const cpuThrottle = Number(process.env.PW_PROFILE_CPU_THROTTLE || DEFAULT_CPU_THROTTLE);
  const trials = Number(process.env.PW_PROFILE_TRIALS || 3);
  if (!Number.isFinite(durationMs) || durationMs < 1000) throw new Error('PW_PROFILE_DURATION_MS must be >= 1000');
  if (!Number.isFinite(cpuThrottle) || cpuThrottle < 1) throw new Error('PW_PROFILE_CPU_THROTTLE must be >= 1');
  if (!Number.isInteger(trials) || trials < 1) throw new Error('PW_PROFILE_TRIALS must be an integer >= 1');

  const traceDir = path.join(root, 'benchmarks', 'traces');
  const outputFile = path.join(root, 'benchmarks', 'p10-particle-profile.json');
  const { server, origin } = await startStaticServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const browserVersion = await browser.version();
    const profiles = [];
    for (const condition of ['rain', 'storm']) {
      for (let trial = 1; trial <= trials; trial++) {
        for (const particlesEnabled of [true, false]) {
          const mode = particlesEnabled ? 'particles' : 'control';
          console.log(`[P10] profiling ${condition}/${mode} trial ${trial}/${trials}: ${durationMs}ms at ${cpuThrottle}x CPU…`);
          profiles.push(await profileCondition(
            browser, origin, condition, particlesEnabled, trial, durationMs, cpuThrottle, traceDir,
          ));
        }
      }
    }
    const summary = ['rain', 'storm'].map((condition) => {
      const particles = aggregateProfiles(profiles, condition, 'particles');
      const control = aggregateProfiles(profiles, condition, 'control');
      return {
        condition,
        particles,
        control,
        attributableMedianDelta: {
          estimatedDroppedFramePct: particles.estimatedDroppedFramePctMedian - control.estimatedDroppedFramePctMedian,
          mainThreadTaskPct: particles.mainThreadTaskPctMedian - control.mainThreadTaskPctMedian,
          recalcStyleDurationMs: particles.recalcStyleDurationMsMedian - control.recalcStyleDurationMsMedian,
          particleLayers: particles.particleLayerCountMedian - control.particleLayerCountMedian,
          estimatedParticleSurfaceBytesUpperBound:
            particles.estimatedParticleSurfaceBytesUpperBoundMedian
            - control.estimatedParticleSurfaceBytesUpperBoundMedian,
        },
      };
    });
    const particleProfiles = profiles.filter((profile) => profile.mode === 'particles');
    const withinBudget = particleProfiles.every((profile) => (
      profile.frames.estimatedDroppedFramePct < 5
      && profile.frames.p95Ms <= 25
      && profile.mainThread.longestObserverTaskMs <= 50
    ));
    const report = {
      generatedAt: new Date().toISOString(),
      method: `Local Chromium headless; ${trials} paired particle/control trials per condition; CDP ${cpuThrottle}x CPU throttle; ${durationMs}ms rAF + DevTools trace per trial.`,
      environment: {
        platform: `${os.platform()} ${os.release()} ${os.arch()}`,
        cpu: os.cpus()[0]?.model || 'unknown',
        logicalCpus: os.cpus().length,
        node: process.version,
        browser: browserVersion,
      },
      profiles,
      summary,
      limitations: [
        'CDP CPU throttling slows the renderer main thread but does not emulate a low-end mobile GPU.',
        'Headless desktop Chromium is a local proxy, not an on-device battery or thermal measurement.',
      ],
      verdict: withinBudget ? 'within budget, leave alone' : 'rewrite justified',
    };
    mkdirSync(path.dirname(outputFile), { recursive: true });
    writeFileSync(outputFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`[P10] verdict: ${report.verdict}`);
    console.log(`[P10] summary: ${path.relative(root, outputFile)}`);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
