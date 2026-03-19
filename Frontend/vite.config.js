import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const backendApiUrl = String(env.VITE_API_URL || "").trim();

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

      // ✅ ONLY for local development
      proxy: backendApiUrl
        ? undefined
        : {
            "/api": {
              target: "http://127.0.0.1:5000",
              changeOrigin: true,
              secure: false,
            },
            "/socket.io": {
              target: "http://127.0.0.1:5000",
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