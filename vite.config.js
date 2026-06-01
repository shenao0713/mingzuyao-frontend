import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiTarget = process.env.VITE_API_TARGET || "http://127.0.0.1:8005";
const wsTarget = apiTarget.replace(/^http/i, "ws");
const extraAllowedHosts = (process.env.VITE_DEV_ALLOWED_HOSTS || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: [
      "tibetan-medicine.lvh.me",
      "tibetan-medicine.localtest.me",
      "tibetan-medicine.test",
      "www.tibetan-medicine.test",
      ...extraAllowedHosts
    ],
    proxy: {
      "/auth": apiTarget,
      "/query": apiTarget,
      "/upload_image": apiTarget,
      "/history": apiTarget,
      "/kb": apiTarget,
      "/system": apiTarget,
      "/health": apiTarget,
      "/uploads": apiTarget,
      "/api/image": apiTarget,
      "/ws": {
        target: wsTarget,
        ws: true
      }
    }
  }
});
