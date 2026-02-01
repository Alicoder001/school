# AI Agent Handoff — School Project

Purpose: This file is a concise handoff so a new AI agent can continue without re‑deriving context.

## Current Status (2026‑02‑01)
- Branch: `phase-1-security` (active; all recent work is here).
- Phase 1 — Security hardening: **done**
- Phase 2 — MediaMTX multi‑node: **done**
- Phase 3 — Desktop Agent MVP: **done**
  - Universal LAN scan CLI
  - Provisioning CLI (create NVR/cameras, test, ONVIF sync, deploy)
  - Agent pairing API + onboarding UI
- Phase 3+ — Tauri wizard + WS‑Discovery: **not started**
- Phase 4 — Observability + auto‑recovery: **not started**
- Phase 5 — Polishing + compliance: **not started**

## Key Files (must know)
- Concept: `docs/SECURE_PUBLIC_MODE_DESKTOP_AGENT_CONCEPT.md`
- Scan CLI: `scripts/agent/scan.ts`
- Provision CLI: `scripts/agent/provision.ts`
- Agent pairing API: `src/modules/agent/presentation/agent.routes.ts`
- Camera/NVR APIs: `src/modules/cameras/presentation/cameras.routes.ts`
- Agent onboarding UI: `frontend/src/pages/AgentOnboarding.tsx`
- Agent API client (frontend): `frontend/src/services/agent.ts`

## CLI Workflow (Agent MVP)
1) Pairing code (admin UI):
   - Route: `/schools/:schoolId/agent`
2) Agent token:
   - `POST /agent/pair` with code → JWT
3) LAN scan:
   - `npm run agent:scan -- --subnet 192.168.1.0/24 --pretty`
4) Provision:
   - `npm run agent:provision -- --api https://api.example --token <AGENT_JWT> --schoolId <id> --input mapping.json --test --sync --deploy`

## Security Rules (do not break)
- Scan is **LAN‑only** by default; public ranges are blocked unless `--allowPublic`.
- No brute‑force / default password attempts in scanner.
- RTSP passwords must stay masked in API output (except explicit super‑admin flag).
- Webhook security: timestamp + nonce + idempotency + optional IP allowlist.
- Agent tokens are **school‑scoped** with short TTL.

## MediaMTX
- Node‑aware URLs returned by `GET /cameras/:id/stream`.
- `MediaNode` model + `School.mediaNodeId` are in DB.
- Deploy flow exists; do not enable restart commands by default.

## Pending Work (recommended order)
1) **Tauri UI wizard**:
   - Step flow: scan → select devices → public mapping → test‑from‑VPS → provision.
   - Use existing CLIs as reference; keep data‑plane out of desktop agent.
2) **WS‑Discovery (optional)**:
   - Add ONVIF WS‑Discovery to improve device discovery.
3) **Diagnostics + Auto‑recovery**:
   - Health checks (RTSP/HTTP/ONVIF), alerting, and simple re‑deploy.
4) **Polish & Compliance**:
   - Retention policy, privacy notes, UI cleanup.

## Required Commands (when changing code)
- Backend build/test: `npm run build`, `npm test`
- Frontend build: `npm run build` in `frontend/`
- Prisma: use `migrate deploy` (non‑interactive). If conflicts, resolve with `prisma migrate resolve`.

## Git Discipline
- Continue in `phase-1-security` unless told otherwise.
- Each phase/feature: `git add` → `git commit` → `git push`.
- Keep commits focused and labeled by phase.

## Known Warnings
- Frontend build warns about chunk size (OK to ignore for now).

---
If anything in this file conflicts with direct user instructions, follow the user.
