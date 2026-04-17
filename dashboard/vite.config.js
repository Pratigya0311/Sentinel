import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8080,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:3000",
      "/snapshot": "http://localhost:4100",
      "/events": "http://localhost:4100"
    }
  }
})

