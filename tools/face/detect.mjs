// People and heads in a photograph, locally — the detector behind scripts/anchor-faces.mjs.
//
// Human 3.3 (@vladmandic/human) on the TensorFlow.js WASM backend. tfjs-node, Human's usual Node backend, does not
// build here (no prebuilt binary for Node 24 on Windows; node-gyp fails), so the WASM build runs the same models in
// plain Node with no native step. Three models, because no one of them is enough on these photographs:
//   - MoveNet MultiPose (up to 6 people, 17 keypoints each): nose, eyes and ears locate a head even in profile or
//     from behind, which a face detector misses; the head's size comes from the ear or eye spacing. Not shipped in the npm package; fetched once from
//     github.com/vladmandic/human-models into tools/face/models/ (git-ignored).
//   - CenterNet (objects): a "person" box for anyone MultiPose misses; the head is taken as the top of the box.
//   - BlazeFace: a close-up face with no body in frame. It fires on shirts and knees at low scores, so a face counts
//     only at 0.75 or more and only where no head was already found.
//
//   cd tools/face && npm install     (once; then scripts/anchor-faces.mjs imports this file)
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, copyFileSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const MODELS = path.join(here, 'models');
const HUMAN_DIR = path.join(here, 'node_modules', '@vladmandic', 'human');
const MULTIPOSE_URL = 'https://raw.githubusercontent.com/vladmandic/human-models/main/models/';

const HEAD_KP = new Set(['nose', 'leftEye', 'rightEye', 'leftEar', 'rightEar']);
export const DETECTOR = {
  name: 'Human 3.3.6 (TensorFlow.js 4.22 WASM): MoveNet MultiPose + CenterNet + BlazeFace; heads v2',
  minBodyScore: 0.25, minKeypointScore: 0.3, minPersonScore: 0.4, minFaceScore: 0.75,
};

async function ensureModels() {
  if (!existsSync(HUMAN_DIR)) throw new Error('tools/face: run `npm install` in tools/face first');
  mkdirSync(MODELS, { recursive: true });
  for (const f of readdirSync(path.join(HUMAN_DIR, 'models'))) {
    if (!existsSync(path.join(MODELS, f))) copyFileSync(path.join(HUMAN_DIR, 'models', f), path.join(MODELS, f));
  }
  for (const f of ['movenet-multipose.json', 'movenet-multipose.bin']) {
    if (existsSync(path.join(MODELS, f))) continue;
    const res = await fetch(MULTIPOSE_URL + f);
    if (!res.ok) throw new Error(`tools/face: could not fetch ${f} (${res.status})`);
    writeFileSync(path.join(MODELS, f), Buffer.from(await res.arrayBuffer()));
  }
}

let human = null;
export async function loadDetector() {
  if (human) return human;
  await ensureModels();
  // Human's WASM build loads models and the .wasm with fetch(); Node's fetch has no file:// — read those from disk.
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (u, o) => {
    const s = typeof u === 'string' ? u : (u.href || u.url);
    if (s.startsWith('file://')) {
      const type = s.endsWith('.json') ? 'application/json' : s.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream';
      return new Response(readFileSync(fileURLToPath(s)), { status: 200, headers: { 'content-type': type } });
    }
    return realFetch(u, o);
  };
  const H = require(path.join(HUMAN_DIR, 'dist', 'human.node-wasm.js'));
  const Human = H.Human || H.default || H;
  human = new Human({
    backend: 'wasm',
    wasmPath: pathToFileURL(path.join(here, 'node_modules', '@tensorflow', 'tfjs-backend-wasm', 'dist') + path.sep).href,
    modelBasePath: pathToFileURL(MODELS + path.sep).href,
    debug: false, cacheSensitivity: 0,
    face: { enabled: true, detector: { rotation: false, maxDetected: 20, minConfidence: 0.3, return: false }, mesh: { enabled: false }, iris: { enabled: false }, description: { enabled: false }, emotion: { enabled: false }, antispoof: { enabled: false }, liveness: { enabled: false } },
    body: { enabled: true, modelPath: 'movenet-multipose.json', maxDetected: 6, minConfidence: DETECTOR.minBodyScore },
    hand: { enabled: false }, gesture: { enabled: false }, segmentation: { enabled: false },
    object: { enabled: true, maxDetected: 20, minConfidence: DETECTOR.minPersonScore },
  });
  await human.load();
  return human;
}

const overlap = (a, b) => {
  const x = Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]));
  const y = Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]));
  return (x * y) / Math.min(a[2] * a[3], b[2] * b[3]);
};

/**
 * Heads in an RGB image. Returns boxes in the image's own pixels, [x, y, w, h], each with where it came from.
 * @param {{data: Uint8Array|Buffer, width: number, height: number}} rgb
 */
export async function detectHeads({ data, width, height }) {
  const h = await loadDetector();
  const t = h.tf.tensor3d(new Uint8Array(data), [height, width, 3]);
  const r = await h.detect(t);
  t.dispose();
  const heads = [];
  const bodyBoxes = [];
  for (const b of r.body || []) {
    if (b.score < DETECTOR.minBodyScore) continue;
    bodyBoxes.push(b.box);
    const kp = b.keypoints.filter((k) => HEAD_KP.has(k.part) && k.score >= DETECTOR.minKeypointScore);
    if (kp.length >= 2) {
      const at = (part) => kp.find((k) => k.part === part)?.position;
      const lEar = at('leftEar'), rEar = at('rightEar'), lEye = at('leftEye'), rEye = at('rightEye'), nose = at('nose');
      const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
      // A head's height from what is visible: ~1.8x the ear-to-ear distance, ~3.2x the eye-to-eye distance, ~4x the
      // eye-to-nose drop; never under 1/9 of a standing body (a back view has none of these).
      const sizes = [];
      if (lEar && rEar) sizes.push(dist(lEar, rEar) * 1.8);
      if (lEye && rEye) sizes.push(dist(lEye, rEye) * 3.2);
      if (nose && (lEye || rEye)) sizes.push(Math.abs(nose[1] - (lEye || rEye)[1]) * 4);
      const hh = Math.max(sizes.length ? Math.max(...sizes) : 0, b.box[3] * 0.11);
      // Centred on the eyes (crown and chin sit about half a head above and below them), else on the keypoints.
      const eyes = [lEye, rEye].filter(Boolean);
      const src = eyes.length ? eyes : kp.map((k) => k.position);
      const cx = src.reduce((a, v) => a + v[0], 0) / src.length, cy = src.reduce((a, v) => a + v[1], 0) / src.length;
      heads.push({ box: [cx - hh * 0.4, cy - hh * 0.5, hh * 0.8, hh], from: 'pose', score: +b.score.toFixed(2) });
    } else {
      heads.push({ box: [b.box[0] + b.box[2] * 0.25, b.box[1], b.box[2] * 0.5, b.box[3] * 0.17], from: 'pose-box', score: +b.score.toFixed(2) });
    }
  }
  for (const o of r.object || []) {
    if (o.label !== 'person' || o.score < DETECTOR.minPersonScore) continue;
    if (bodyBoxes.some((bb) => overlap(bb, o.box) > 0.5)) continue;
    heads.push({ box: [o.box[0] + o.box[2] * 0.25, o.box[1], o.box[2] * 0.5, Math.max(o.box[3] * 0.17, Math.min(o.box[2] * 0.5, o.box[3]))], from: 'person-box', score: +o.score.toFixed(2) });
  }
  for (const f of r.face || []) {
    if (f.score < DETECTOR.minFaceScore) continue;
    if (heads.some((hd) => overlap(hd.box, f.box) > 0.3)) continue;
    heads.push({ box: f.box, from: 'face', score: +f.score.toFixed(2) });
  }
  return heads.map((hd) => ({ ...hd, box: hd.box.map((v) => Math.round(v)) }));
}
