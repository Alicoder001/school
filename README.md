Attendance System

Setup & run

1. Install dependencies:

```
npm install
```

2. Run Prisma migrate:

```
npm run db:migrate
```

3. Seed database:

```
npm run db:seed
```

4. Start dev server:

```
npm run dev
```

Webhook URLs: use `/webhook/:schoolId/in` and `/webhook/:schoolId/out` (see `/schools/:id/webhook-info`).

Production notes:
- Set `JWT_SECRET`, `CORS_ORIGINS`, `SSE_TOKEN_TTL_SECONDS`, and `REDIS_URL` (for horizontal scale pub/sub).
- SSE uses short-lived tokens via `/auth/sse-token` when `NODE_ENV=production`.
- Webhook secrets are enforced in production (query param `secret` or header `x-webhook-secret`).

NVR setup (camera management)

- Add `CREDENTIALS_SECRET` (used to encrypt NVR passwords). In production it is required.
- Create NVR: `POST /schools/:schoolId/nvrs`
- Health check: `POST /nvrs/:id/test-connection`
- Sync areas/cameras manually: `POST /nvrs/:id/sync`
- List cameras: `GET /schools/:schoolId/cameras`
- List areas: `GET /schools/:schoolId/camera-areas`

Sample NVR payload:

```json
{
  "name": "Main NVR",
  "vendor": "ONVIF",
  "model": "8232C",
  "host": "192.168.1.50",
  "httpPort": 80,
  "onvifPort": 80,
  "rtspPort": 554,
  "username": "admin",
  "password": "secret",
  "protocol": "ONVIF",
  "isActive": true
}
```

Sample sync payload:

```json
{
  "areas": [
    { "name": "Entrance", "externalId": "area-1" },
    { "name": "Backyard", "externalId": "area-2" }
  ],
  "cameras": [
    {
      "name": "Gate Cam",
      "externalId": "cam-001",
      "channelNo": 1,
      "streamUrl": "rtsp://user:pass@192.168.1.50:554/Streaming/Channels/101",
      "status": "ONLINE",
      "areaExternalId": "area-1"
    }
  ]
}
```
