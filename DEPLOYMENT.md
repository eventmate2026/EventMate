# EventMate Deployment

This project is configured for:

- Frontend: Vercel
- Backend: Render
- No custom domain required

## Frontend env on Vercel

```env
VITE_API_URL=https://your-render-service.onrender.com
```

## Backend env on Render

Required:

```env
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/EventMate?retryWrites=true&w=majority
JWT_SECRET=replace-with-a-long-random-secret
JWT_REFRESH_SECRET=replace-with-a-different-long-random-secret
CERTIFICATE_DOWNLOAD_SECRET=replace-with-a-third-long-random-secret

FRONTEND_URL=https://eventmate-app.vercel.app
FRONTEND_URLS=https://eventmate-app.vercel.app,https://eventmate-app-your-projects.vercel.app
BACKEND_URL=https://your-render-service.onrender.com
```

Recommended email config for no custom domain:

```env
EMAIL_PROVIDER=smtp
EMAIL_FROM_NAME=EventMate
EMAIL_FROM_EMAIL=your-gmail-address@gmail.com
EMAIL_REPLY_TO=your-gmail-address@gmail.com

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-gmail-address@gmail.com
SMTP_PASS=your-gmail-app-password
SMTP_FAMILY=4
SMTP_POOL=true
SMTP_MAX_CONNECTIONS=5
SMTP_CONNECTION_TIMEOUT_MS=30000
SMTP_GREETING_TIMEOUT_MS=30000
SMTP_SOCKET_TIMEOUT_MS=45000
```

Optional:

```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-key
CLOUDINARY_API_SECRET=your-cloudinary-secret

CORS_DEBUG=false
NOTIFICATION_EMAIL_WORKER_ENABLED=true
EMAIL_DELIVERY_TRACKING_MODE=PROVIDER_ACCEPTANCE
EMAIL_EVENT_WEBHOOK_SECRET=
```

## Notes

- Keep `EMAIL_DELIVERY_TRACKING_MODE=PROVIDER_ACCEPTANCE` unless you intentionally configure provider webhook delivery.
- Leave `EMAIL_EVENT_WEBHOOK_SECRET` empty unless you turn on webhook delivery.
- For Gmail SMTP on Render, prefer `SMTP_PORT=587`, `SMTP_SECURE=false`, and `SMTP_FAMILY=4`.
- Without a custom domain, Gmail SMTP is the safer default than SendGrid with a Gmail sender address.
- Use these health endpoints after deploy:
  - `https://your-render-service.onrender.com/healthz`
  - `https://your-render-service.onrender.com/readyz`
