/// <reference types="vitest" />
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  const target = mode === "firefox" ? "firefox" : "chromium";

  return {
    plugins: [react()],
    publicDir: "public",
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
        "@platform-runtime": resolve(__dirname, `src/platform/${target}/api.ts`)
      }
    },
    build: {
      outDir: `dist/${target}`,
      emptyOutDir: true,
      sourcemap: false,
      rollupOptions: {
        input: {
          popup: resolve(__dirname, "popup.html"),
          review: resolve(__dirname, "review.html"),
          options: resolve(__dirname, "options.html")
        },
        output: {
          entryFileNames: "assets/[name].js",
          chunkFileNames: "assets/[name].js",
          assetFileNames: "assets/[name][extname]"
        }
      }
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["tests/setup.ts"],
      alias: {
        "@platform-runtime": resolve(__dirname, "src/platform/chromium/api.ts")
      }
    }
  };
});
