import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => {
  const backendEnvDir = fileURLToPath(new URL("../Backend", import.meta.url));
  const backendEnv = loadEnv(mode, backendEnvDir, "");
  const backendPort = String(backendEnv.PORT || "5000").trim() || "5000";
  const backendApiUrl = String(backendEnv.VITE_API_URL || backendEnv.API_URL || "").trim();
  const backendTarget = backendApiUrl || `http://localhost:${backendPort}`;

  return {
    plugins: [react()],
    define: {
      "import.meta.env.VITE_BACKEND_PORT": JSON.stringify(backendPort),
      "import.meta.env.VITE_API_URL": JSON.stringify(backendApiUrl),
    },
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
      },
    },
    preview: {
      host: true,
      port: 4173,
    },
  };
});
