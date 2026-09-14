import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only the canonical tests/ tree. Without this, vitest also scanned the
    // stale `.claude/worktrees/*` clones from prior sessions, running duplicate
    // OLD-code copies of the suite — which flaked and polluted the count,
    // making "suite green" non-deterministic. dist/ is build output.
    include: ['tests/**/*.test.js'],
    exclude: ['node_modules/**', '.claude/**', 'dist/**', '.git/**'],
    // The suite now runs inside the Vercel build (package.json build →
    // `vitest run && …`), where the project's env vars ARE populated. Every
    // test assumes none of them are set — a real Upstash client alone hangs
    // six files. Clear them before any test module imports a handler.
    setupFiles: ['tests/setup/clear-runtime-env.js'],
    // Vitest's default is 5 s per test, which several honest-but-slow files
    // (client-bundle, image-slot-manifest, witty-day-tags) sit close to. They
    // pass comfortably in isolation and fail with "Test timed out in 5000ms"
    // only when the whole suite runs them in parallel on a loaded machine —
    // an assertion never fires, the clock does. That made `npm run build`,
    // which gates on `vitest run`, intermittently red for reasons unrelated to
    // the change being built. 30 s is still far below any real hang.
    testTimeout: 30000,
  },
});
