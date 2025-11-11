import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"], // one entry per Lambda file
  bundle: true, // bundle everything into single files
  format: ["esm"], // Node 20 prefers ESM
  platform: "node",
  target: "node20", // matches Lambda runtime
  minify: false, // smaller zip size
  sourcemap: false,
  clean: true, // clears dist/ before build
  dts: true, // optional: generates .d.ts
  splitting: false, // avoid code splitting for Lambda single-file output
  external: [], // leave empty to bundle all dependencies
});
