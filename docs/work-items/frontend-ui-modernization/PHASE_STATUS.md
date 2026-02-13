# PHASE STATUS

## Branch
`migration/frontend-ui-modernization/phase-00-foundation`

## Phase 00 - Foundation + Hujjatlash
Status: `DONE`

Completed:
1. Work-item docs yaratildi (`TASKS.md`, `IMPLEMENTATION_PLAN.md`, `ROADMAP.md`).
2. Tailwind v4 + shadcn baseline qo'shildi.
3. TanStack Query provider va query key contracts qo'shildi.
4. Zustand stores (`auth.store`, `ui.store`) qo'shildi.
5. Feature flags qo'shildi.
6. Validation:
   - `npm run typecheck` pass
   - `npm run lint` pass
   - `npm run build` pass

## Phase 01 - V2 Shell + Lazy Routing
Status: `DONE`

Completed:
1. `AppShellV2` qo'shildi.
2. Router lazy modelga o'tkazildi.
3. V2 routes qo'shildi (`dashboard`, `students`, `devices`).
4. Feature-flag based enable/force redirect qo'shildi.
5. V1 fallback saqlandi.

## Phase 02 - Dashboard V2 Pilot
Status: `IN_PROGRESS`

Completed:
1. `DashboardV2` page qo'shildi.
2. Query hooks (`useDashboardQuery/useDashboardMutations`) ishlatilmoqda.
3. SSE parity event invalidation qo'shildi.
4. Filter/history/chart/recent UI qo'shildi.

Pending:
1. Manual parity smoke checklist.

## Phase 03 - Students V2 Pilot
Status: `IN_PROGRESS`

Completed:
1. `StudentsV2` page qo'shildi.
2. TanStack `DataTable` bilan list.
3. RHF + Zod form modal.
4. Import/export/template oqimi qo'shildi.
5. Query invalidation/refetch parity qo'shildi.

Pending:
1. Manual parity smoke checklist.

## Phase 04 - Devices V2 Pilot
Status: `IN_PROGRESS`

Completed:
1. `DevicesV2` page qo'shildi.
2. TanStack `DataTable` bilan list.
3. RHF + Zod form modal.
4. Webhook copy/reveal UI qo'shildi.
5. Query invalidation/refetch parity qo'shildi.

Pending:
1. Manual parity smoke checklist.

## Phase 05 - Pilot Hardening
Status: `NEXT`

Planned:
1. Unit tests (flags/query contracts/hooks).
2. Manual smoke pass (`SMOKE_CHECKLIST.md`).
3. Pilot signoff artifact.
