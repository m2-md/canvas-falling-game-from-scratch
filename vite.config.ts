import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

// Kök dizindeki her HTML ayrı bir sayfa; girdiye eklenmezse yalnızca index.html derlenir.
// Listeyi dizinden okuyoruz ki sayfa adı değişince config'i güncellemek gerekmesin.
const pages = Object.fromEntries(
  readdirSync(import.meta.dirname)
    .filter((f) => f.endsWith(".html"))
    .map((f) => [f.slice(0, -5).replace(/[^A-Za-z0-9]/g, "_"), resolve(import.meta.dirname, f)]),
);

export default defineConfig({
  build: { rollupOptions: { input: pages } },
});
