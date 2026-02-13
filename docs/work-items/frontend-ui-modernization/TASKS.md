# TASKS

## Frontend UI Modernization (apps/frontend)

## Epic 1 - Foundation (Phase 00)
- [x] Migration branch ishga tushirish (`migration/frontend-ui-modernization/phase-00-foundation`)
- [x] Work-item hujjatlari yaratish (`TASKS.md`, `IMPLEMENTATION_PLAN.md`, `ROADMAP.md`)
- [x] Tailwind v4 + Vite plugin ulash
- [x] shadcn source-based baseline (`components.json`, `cn()` util, base UI primitives)
- [x] TanStack Query provider skeleton
- [x] Zustand store skeleton (`auth.store.ts`, `ui.store.ts`)
- [x] Feature flags qo'shish (`VITE_UI_V2_ENABLED`, `VITE_UI_V2_PAGES`, `VITE_UI_V2_FORCE`)
- [x] Phase 00 quality gate: `build + typecheck + lint`

## Epic 2 - V2 Shell + Lazy Routing (Phase 01)
- [x] `AppShellV2` yaratish (sidebar/header/content)
- [x] `AppRouter`ni lazy route modelga o'tkazish
- [x] V2 pilot routelarni qo'shish:
  - [x] `/v2/schools/:schoolId/dashboard`
  - [x] `/v2/schools/:schoolId/students`
  - [x] `/v2/schools/:schoolId/devices`
- [x] V2 routingni feature flag bilan boshqarish
- [x] V1 fallback parityni saqlash
- [ ] Phase 01 quality gate: auth/role smoke (manual)

## Epic 3 - Dashboard V2 Pilot (Phase 02)
- [x] `DashboardV2` page yaratish (shadcn + Tailwind)
- [x] `useDashboardQuery/useDashboardMutations` bilan stats/recent/history ulash
- [x] SSE event parity (`useAttendanceSSE`) + query invalidation
- [x] Period/class filter parity
- [x] History dialog parity
- [x] Weekly chart + recent events parity
- [ ] Phase 02 quality gate: dashboard smoke + manual checklist

## Epic 4 - Students V2 Pilot (Phase 03)
- [x] `StudentsV2` page yaratish
- [x] TanStack Table asosida students jadval
- [x] RHF + Zod bilan create/edit dialog
- [x] Import/export/template oqimini parity bilan ko'chirish
- [x] Query invalidation + refresh parity
- [ ] Phase 03 quality gate: CRUD + import smoke

## Epic 5 - Devices V2 Pilot (Phase 04)
- [x] `DevicesV2` page yaratish
- [x] TanStack Table asosida devices jadval
- [x] RHF + Zod bilan create/edit dialog
- [x] Webhook info card (copy/reveal parity)
- [x] Query invalidation + refresh parity
- [ ] Phase 04 quality gate: CRUD + webhook smoke

## Epic 6 - Pilot Hardening (Phase 05)
- [ ] Unit tests (feature flags, query key contracts, critical hooks)
- [ ] Smoke checklist (routing/auth/dashboard/students/devices)
- [ ] Manual regression report
- [ ] Pilot demo package tayyorlash

## Epic 7 - Full Migration Waves (Post-Pilot)
- [ ] Wave A: Holidays, Classes, Users, Schools
- [ ] Wave B: Attendance, StudentDetail
- [ ] Wave C: Cameras, SuperAdminDashboard
- [ ] Har wave oxirida AntD usage reduction audit

## Epic 8 - AntD Deprecation + Cutover
- [ ] V2 default qilish
- [ ] V1 read-only fallback window
- [ ] AntD dependency remove reja
- [ ] Final rollback playbook

## Acceptance Checklist
- [ ] Backend API contract o'zgarmagan
- [ ] V2 feature flag orqali yoqiladi/o'chadi
- [ ] Pilot 3 page (dashboard/students/devices) parityga ega
- [ ] Typecheck va lint green
- [ ] Critical smoke checklist pass

## Execution Board
Status legend:
- `DONE`
- `IN_PROGRESS`
- `NEXT`
- `BLOCKED`

### Current
- `IN_PROGRESS` Epic 3/4/5 quality gates (manual parity + smoke)
- `NEXT` Epic 6 (pilot hardening)
- `NEXT` Epic 7 (full migration waves)
