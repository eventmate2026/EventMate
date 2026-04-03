import { io } from "socket.io-client";
import { getStoredToken } from "./auth";
import { SOCKET_BASE_URL } from "./backendUrl";

export const createAuthenticatedSocket = () => {
  if (SOCKET_BASE_URL === null) return null;
  if (!getStoredToken()) return null;

  return io(SOCKET_BASE_URL, {
    transports: ["polling", "websocket"],
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    timeout: 8000,
    auth: (callback) => {
      callback({ token: getStoredToken() || "" });
    },
  });
};
