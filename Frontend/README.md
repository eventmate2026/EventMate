# EventMate Frontend (React + Tailwind)

This folder is a React + Tailwind UI that maps directly to the existing backend routes in `Backend/`.

## Setup

```bash
cd Frontend
npm install
npm run dev
```

The default dev server runs on `http://localhost:5173`.

## Environment

- Local development: leave `VITE_API_URL` unset and the Vite dev server will proxy `/api` and `/socket.io` to the backend using the `PORT` from `Backend/.env`.
- Production and Vercel: set `VITE_API_URL=https://your-backend.onrender.com`.
- Render backend: set `BACKEND_URL=https://your-backend.onrender.com` so email and certificate links point to the deployed API.

## Backend CORS

Set the backend `FRONTEND_URL` to the same origin as the dev server, for example:

```
FRONTEND_URL=http://localhost:5173
```

## Notes

- Tokens are stored in `localStorage` and attached to protected requests as `Authorization: Bearer <token>`.
- Refresh token flow is supported via `/api/auth/refresh-token`.
- Password reset uses public backend routes: `/api/user/forgot-password` and `/api/user/reset-password`.
