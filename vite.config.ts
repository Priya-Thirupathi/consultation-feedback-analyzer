import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev proxies /api to Express on 3000, so there is no CORS setup and no second
// base URL to keep in sync between dev and the built app Express serves.
export default defineConfig({
  plugins: [react()],
  root: "client",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
