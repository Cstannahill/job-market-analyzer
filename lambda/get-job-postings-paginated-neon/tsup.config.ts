import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/*.ts"],
  bundle: true,
  format: ["esm"],
  platform: "node",
  target: "node20",
  minify: true,
  sourcemap: false,
  clean: true,
  dts: true,
  splitting: false,
  external: [],
});
