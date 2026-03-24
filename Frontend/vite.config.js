import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => {
  const frontendEnvDir = fileURLToPath(new URL(".", import.meta.url));
  const backendEnvDir = fileURLToPath(new URL("../Backend", import.meta.url));
  const frontendEnv = loadEnv(mode, frontendEnvDir, "");
  const backendEnv = loadEnv(mode, backendEnvDir, "");
  const backendPort = String(backendEnv.PORT || "5000").trim() || "5000";
  const backendApiUrl = String(frontendEnv.VITE_API_URL || "").trim();
  const backendTarget = backendApiUrl || `http://127.0.0.1:${backendPort}`;

  return {
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            "react-vendor": ["react", "react-dom", "react-router-dom"],
            motion: ["framer-motion"],
            icons: ["lucide-react", "react-icons"],
            http: ["axios"],
            socket: ["socket.io-client"],
          },
        },
      },
    },
    server: {
      host: true,
      port: 5173,
      proxy: {
        "/api": {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        "/socket.io": {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
          ws: true,
        },
      },
    },
    preview: {
      host: true,
      port: 4173,
    },
  };
});
