import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * `lib/` unit tests only. These are pure functions over crypto primitives — no
 * network, no chain, no DOM — so the default node environment is enough and
 * keeps the suite fast.
 */
export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
    // Poseidon's first call builds its constants, which is slow enough to trip
    // the default timeout on a cold run.
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
