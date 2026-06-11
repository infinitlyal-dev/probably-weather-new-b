import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only the canonical tests/ tree. Without this, vitest also scanned the
    // stale `.claude/worktrees/*` clones from prior sessions, running duplicate
    // OLD-code copies of the suite — which flaked and polluted the count,
    // making "suite green" non-deterministic. dist/ is build output.
    include: ['tests/**/*.test.js'],
    exclude: ['node_modules/**', '.claude/**', 'dist/**', '.git/**'],
  },
});
