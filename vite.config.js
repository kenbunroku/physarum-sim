import { defineConfig } from "vite";
import glsl from "vite-plugin-glsl";

export default defineConfig(() => {
  return {
    root: "src",
    publicDir: "../public",
    // base: "/physarum-sim/",
    build: {
      outDir: "../dist",
      emptyOutDir: true,
    },
    plugins: [glsl()],
  };
});
