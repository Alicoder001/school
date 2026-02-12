# Apps Separation Map

## Target Layout

| Current | Target | Status |
|---|---|---|
| `frontend/**` | `apps/frontend/**` | DONE (copy-first + legacy wrapper delegation) |
| `server.ts` | `apps/backend/server.ts` | DONE (copy-first + root command switch) |
| `src/**` | `apps/backend/src/**` | DONE (copy-first + root command switch) |
| `prisma/**` | `apps/backend/prisma/**` | DONE (copy-first + root command switch) |
| `scripts/**` (backend scripts) | `apps/backend/scripts/**` | DONE (copy-first + root command switch) |
| Root backend util skriptlar (`fix-*`, `update-*`, `check_schools.ts`, `seed-today.ts`, `test-camera-stream.ts`, `get_secrets.ts`) | `apps/backend/*.ts` | DONE (parity copy, legacy root saqlangan) |
| `vitest.config.ts` (backend test config) | `apps/backend/vitest.config.ts` | DONE (parity copy) |
| `Dockerfile` | `apps/backend/Dockerfile` | DONE (root `Dockerfile` removed, canonical inside app) |
| `docker-compose.yml` | root orchestration, backend build -> `apps/backend/Dockerfile` | DONE (updated) |

## Runtime Path Sensitive Areas

| File | Current Assumption | Migration Risk |
|---|---|---|
| `src/modules/attendance/interfaces/http/webhook.routes.ts` | helper (`getUploadsDir`) | mitigated (step-1 done) |
| `src/modules/students/interfaces/http/students.routes.helpers.ts` | helper (`getUploadsDir`) | mitigated (step-1 done) |
| `src/modules/cameras/services/mediamtx-runner.service.ts` | helper (`getToolsDir`) | mitigated (step-1 done) |
| `scripts/setup-mediamtx.ts` | helper (`getToolsDir`) | mitigated (step-1 done) |
| `src/prisma.ts` | helper (`getEnvFilePath`) | mitigated (step-1 done) |
| `server.ts` | helper (`getUploadsDir`) | mitigated (parity done) |

## Remaining Gap

- Docker runtime verify (`docker build`, `docker compose up`) local envda `docker` yo'qligi sabab pending.

## Cross-Agent Safety

- `apps/student-registrator/**`ga tegilmaydi.
- Frontend business logic/UXga tegilmaydi; faqat location/wiring.
- Backend API behavior o'zgarmaydi; move-only.
