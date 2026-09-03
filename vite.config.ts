import { resolve } from "node:path";
import { defineConfig } from "vite";

// Every HTML file in the root is a separate page; without an input entry only index.html is built.
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
