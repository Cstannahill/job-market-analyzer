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
    // Pick up tests moved to project root /tests plus any legacy src tests
    include: [
      "tests/**/*.{test,spec}.{js,ts,jsx,tsx,mjs}",
      "src/**/*.{test,spec}.{js,ts,jsx,tsx,mjs}",
    ],
    exclude: ["**/node_modules/**", "e2e/**", "dist/**"],
    coverage: {
      reporter: ["text", "lcov"],
    },
  },
});
