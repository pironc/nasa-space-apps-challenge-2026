import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  // Sub-path hosting (GitHub Pages) sets VITE_BASE; everywhere else the app lives at the root.
  base: process.env.VITE_BASE ?? "/",
  plugins: [react(), tailwindcss()],
  // The analysis service (FastAPI). `vite preview` uses the same proxy.
  server: { proxy: { "/api": "http://localhost:8000" } },
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
})
