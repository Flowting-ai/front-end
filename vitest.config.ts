import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Lightweight unit-test config. Tests target pure logic modules (no DOM), so the
// default node environment is sufficient. The `@` alias mirrors tsconfig paths.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
