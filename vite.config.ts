import { resolve } from "node:path";
import { defineConfig } from "vite";

// Kok dizindeki her HTML ayri bir sayfa; girdiye eklenmezse yalnizca index.html derlenir.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        atesbocekleri: resolve(import.meta.dirname, "atesbocekleri.html"),
        index: resolve(import.meta.dirname, "index.html"),
      },
    },
  },
});
