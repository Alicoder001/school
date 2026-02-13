# ROADMAP

## Frontend UI Modernization (Pilot-first)

## Week 1 - Foundation + Infra
Deliverables:
1. Work-item docs tayyor.
2. Tailwind v4 + shadcn baseline.
3. TanStack Query provider.
4. Zustand stores.
5. Feature flag infra.

Gate:
1. Build/typecheck/lint green.

Risks:
1. Dependency conflicts.
Mitigation:
1. Incremental install + CI checks.

## Week 2 - V2 Shell + Routing
Deliverables:
1. Lazy route model.
2. `AppShellV2`.
3. V2 pilot routes flag ostida.

Gate:
1. Auth/role routing smoke pass.

Risks:
1. Route regressiya.
Mitigation:
1. V1 fallback parallel saqlanadi.

## Week 3 - Dashboard V2
Deliverables:
1. Dashboard V2 page.
2. Query + SSE parity.
3. History dialog parity.

Gate:
1. Stats/recent/history parity checklist.

Risks:
1. Realtime update drift.
Mitigation:
1. SSE event-driven query invalidation.

## Week 4 - Students V2
Deliverables:
1. Students V2 page.
2. TanStack DataTable.
3. RHF + Zod create/edit modal.
4. Import/export/template parity.

Gate:
1. CRUD + import smoke pass.

Risks:
1. Form validation mismatch.
Mitigation:
1. Schema-based validation + regression checks.

## Week 5 - Devices V2 + Pilot Hardening
Deliverables:
1. Devices V2 page.
2. Webhook card parity.
3. Pilot hardening checklist.
4. Demo-ready package.

Gate:
1. Pilot signoff candidate.

Risks:
1. Webhook UX parity.
Mitigation:
1. Side-by-side behavior checklist.

## Week 6-8 - Post-Pilot Waves (after approval)
Wave A:
1. Holidays, Classes, Users, Schools.

Wave B:
1. Attendance, StudentDetail.

Wave C:
1. Cameras, SuperAdminDashboard.

Per-wave Gate:
1. AntD usage reduction audit.
2. Quality checks + smoke pass.

## Final Cutover
1. V2 default qilish.
2. V1 read-only fallback window.
3. AntD deprecation cleanup.
4. Rollback playbook final update.
