import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/setupTests.ts"],
    // Only run tests inside our source tree; exclude node_modules and e2e runners
    include: [
      "src/**/*.test.{js,ts,jsx,tsx,mjs}",
      "src/**/*.spec.{js,ts,jsx,tsx,mjs}",
    ],
    exclude: ["**/node_modules/**", "e2e/**"],
    coverage: {
      reporter: ["text", "lcov"],
    },
  },
});
