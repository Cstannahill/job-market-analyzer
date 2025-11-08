import { defineConfig } from "vite";
import path from "path";
// import react from "@vitejs/plugin-react-swc";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import svgr from "vite-plugin-svgr";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), svgr()],
  publicDir: "public",
  root: ".",
  base: "/", // important for correct asset URLs on Amplify
  build: { outDir: "dist" },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
