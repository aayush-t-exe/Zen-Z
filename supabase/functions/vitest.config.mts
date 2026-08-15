import { defineConfig } from 'vitest/config';

// Edge Function `logic.ts` modules are plain TS with zero Deno-specific
// imports, so they run under Node/Vitest directly — no Deno CLI needed.
// `index.ts` files (Deno.serve handlers, deno.land/esm.sh imports) are
// intentionally excluded; they're thin wiring, not covered here.
//
// `root` is pinned to this directory rather than left to default to the
// caller's cwd — this config is invoked as `vitest run --config
// supabase/functions/vitest.config.mts` from the repo root (see root
// package.json's test:functions script), and without an explicit root the
// `include` glob below would also pick up apps/admin's and apps/mobile's
// own test files.
export default defineConfig({
  root: import.meta.dirname,
  test: {
    include: ['**/*.test.ts'],
    environment: 'node',
  },
});
