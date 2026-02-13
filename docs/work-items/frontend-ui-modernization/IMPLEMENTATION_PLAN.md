# IMPLEMENTATION PLAN

## Project
Frontend UI Modernization (apps/frontend)

## Problem Statement
`apps/frontend` UI qatlami AntD va inline style'ga kuchli bog'langan. Natijada:
1. Design system izchilligi past.
2. Component-level reuse cheklangan.
3. Route-level lazy loading yo'qligi sabab initial yuklanish katta.
4. Server-state boshqaruvi qo'lda (`useEffect/useState`) bo'lib, cache/invalidation standard emas.

## Objective
1. Pilot scope'da (`dashboard`, `students`, `devices`) `Tailwind + shadcn + TanStack Query + Zustand`ga o'tish.
2. V2 route/feature-flag orqali xavfsiz cutover qilish.
3. Existing business logic va backend contractlarni saqlash.
4. DRY/KISS/SOLID tamoyillarini qat'iy qo'llash.

## Scope
In-scope:
1. `apps/frontend` (pilot routes only).
2. V2 shell, lazy router, feature flags.
3. Pilot page migration:
   - `dashboard`
   - `students`
   - `devices`
4. Work-item docs + quality gates.

Out-of-scope:
1. `apps/student-registrator`.
2. Backend endpoint refactor.
3. Non-pilot pages full migration (post-pilot wave).

## Current State (Audit Snapshot)
1. AntD importli fayllar: keng qamrovli.
2. Inline style usage yuqori.
3. Router eager import modelda.
4. Query/store stack yo'q.

## Target Architecture
1. UI primitives: source-based shadcn components.
2. Styling: Tailwind v4 CSS-first tokens.
3. Server-state: TanStack Query (`queryKeys.dashboard/students/devices`).
4. Client-state: Zustand (`auth.store`, `ui.store`).
5. Routing: `React.lazy` + `Suspense` + V2 feature flags.
6. Rollout: parallel V1/V2 with controlled cutover.

## Public/Internal Contracts
1. New Routes:
   - `/v2/schools/:schoolId/dashboard`
   - `/v2/schools/:schoolId/students`
   - `/v2/schools/:schoolId/devices`
2. Feature Flags:
   - `VITE_UI_V2_ENABLED`
   - `VITE_UI_V2_PAGES`
   - `VITE_UI_V2_FORCE`
3. Query Contracts:
   - `queryKeys.dashboard`
   - `queryKeys.students`
   - `queryKeys.devices`
4. Hook Contracts:
   - `useDashboardQuery/useDashboardMutations`
   - `useStudentsQuery/useStudentsMutations`
   - `useDevicesQuery/useDevicesMutations`
5. Table Contract:
   - `DataTable<TData, TValue>`

## Engineering Standards
1. DRY:
   - Query keys markazlashtiriladi.
   - Table rendering shared component orqali.
2. KISS:
   - Har pilot page uchun bitta canonical data flow.
3. SOLID:
   - SRP: page orchestration, data hooks, UI primitives alohida.
   - DIP: pages service implementationga emas, hook contractga tayanadi.

## Phase Execution

### Phase 00
1. Dependencies + docs + base providers.
2. shadcn baseline + Tailwind tokens.
3. Query/store/flag skeleton.

Exit:
1. `npm run build`, `npm run typecheck`, `npm run lint` green.

### Phase 01
1. V2 shell.
2. Lazy router.
3. V2 routes behind flag.

Exit:
1. Auth/role parity.
2. V1 fallback intact.

### Phase 02
1. Dashboard V2 migration.
2. Query + SSE parity.

Exit:
1. Stats/history/recent parity smoke pass.

### Phase 03
1. Students V2 migration.
2. Table + forms + import/export parity.

Exit:
1. CRUD/import parity smoke pass.

### Phase 04
1. Devices V2 migration.
2. Table + forms + webhook parity.

Exit:
1. CRUD/webhook parity smoke pass.

### Phase 05
1. Pilot hardening.
2. Manual checklist + demo.

Exit:
1. Pilot signoff ready.

## Quality Gates
Mandatory (har phase):
1. Typecheck clean.
2. Lint clean.
3. Smoke checklist pass.
4. Critical flows regression yo'q.

## Test Strategy
1. Unit:
   - Feature flag parser.
   - Query key stability.
   - Core hook behavior.
2. Smoke:
   - Routing/auth.
   - Dashboard filters/realtime/history.
   - Students CRUD/import/export.
   - Devices CRUD/webhook.

## Risks and Mitigations
1. Regression risk:
   - Mitigation: V2 behind flag + V1 fallback.
2. Scope creep:
   - Mitigation: pilot-only freeze.
3. Data flow drift:
   - Mitigation: service layer unchanged, hook wrappers only.
4. UX parity gap:
   - Mitigation: manual parity checklist before signoff.

## Rollout and Rollback
1. Rollout:
   - `VITE_UI_V2_ENABLED=true`
   - `VITE_UI_V2_PAGES=dashboard,students,devices`
2. Rollback:
   - `VITE_UI_V2_ENABLED=false`
3. No-downtime:
   - backend untouched, frontend-only reversible rollout.
