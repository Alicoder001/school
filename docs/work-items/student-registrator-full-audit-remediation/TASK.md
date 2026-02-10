# TASK - Student Registrator Full Audit Remediation

## Goal
Student Registrator desktop (React + Tauri) loyihasini professional darajaga olib chiqish: DRY/KISS/SOLID, security, UX/a11y, performance, testability va operatsion ishonchlilik bo'yicha to'liq hardening.

## Scope
In scope:
1. `apps/student-registrator/src/**`
2. `apps/student-registrator/src-tauri/src/**`
3. Build/lint/tooling (`eslint`, `tsconfig`, `vite`, `cargo` quality gates)
4. Docs/runbook va rollout hujjatlari

Out of scope:
1. Yangi product featurelar (faqat reliability, maintainability, UX quality)
2. Tashqi backend servislarni to'liq qayta yozish
3. Platform migration (Tauri -> boshqa stack)

## Workstreams

### WS0 - Baseline and Program Setup
- [ ] Current baseline ni freeze qilish: typecheck, lint, build, cargo check, cargo clippy
- [ ] Critical flow smoke checklist yaratish: Login, Devices, Add Students, Students, Device Detail, Audit Logs
- [ ] Risk register va ownership (frontend/tauri/security/qa) aniqlash
- [ ] Branching va release cut strategy belgilash (incremental hardening)

### WS1 - Critical Blockers (P0)
- [ ] Lint configni to'g'rilash: `src-tauri/target/**` va generated fayllarni ignore qilish
- [ ] Rust panic risklarini yopish: `expect/unwrap` o'rniga safe error path
- [ ] Invalid table markupni tuzatish (`<tr>` ichidagi modal `<div>` anti-pattern)
- [ ] `src/index.css` dublikat/corrupt bloklarni tozalash
- [ ] Production flowdagi ortiqcha `console.*` ni debug gate bilan boshqarish
- [ ] Mojibake/encoding xatolarini to'liq tuzatish

### WS2 - Security and Privacy Hardening
- [ ] Auth token storage strategiyasini qayta ko'rib chiqish (XSS-risk kamaytirish)
- [ ] Local device credentials saqlashni himoyalash (at-rest protection/encryption policy)
- [ ] Sensitive data redaction qatlamini joriy qilish (password/token/secret/biometric)
- [ ] Log va error payloadlarda maxfiy ma'lumot sizib chiqmasligini test bilan kafolatlash
- [ ] Security checklist va sign-off hujjatlarini yangilash

### WS3 - SOLID/SRP Architecture Refactor
- [ ] `src/api.ts` ni domain modullarga ajratish (`auth`, `devices`, `students`, `provisioning`, `images`)
- [ ] `src-tauri/src/commands.rs` ni command/domain servis qatlamiga bo'lish
- [ ] Katta page'larni orchestration + feature hooks + presentational komponentlarga ajratish
- [ ] Frontend va Tauri command contractlarini typed va versioned holatga keltirish

### WS4 - DRY/KISS and Duplicate Logic Cleanup
- [ ] Ism split/gender normalize/image encode logiclarini yagona shared utilga birlashtirish
- [ ] Import workflows (`AddStudents` va `DeviceDetail`) ni shared use-case bilan yakuniy konsolidatsiya qilish
- [ ] Device resolution va status derivationni bitta canonical helperga standartlash
- [ ] Dead code va ishlatilmayotgan komponent/hook/stylelarni olib tashlash

### WS5 - Error Handling and Contract Quality
- [ ] `catch {}` bloklarini explicit typed error handling bilan almashtirish
- [ ] Unified error code taxonomy joriy qilish (frontend + tauri)
- [ ] `any` va unsafe castlarni yo'qotish
- [ ] User-facing error message policy: aniq, xavfsiz, action-oriented
- [ ] Rust clippy warninglarini to'liq yopish

### WS6 - UX and Accessibility
- [ ] `alert/confirm` ni app-modal/toast pattern bilan almashtirish
- [ ] Icon-only buttonlar uchun `aria-label` coverage 100% qilish
- [ ] Modal focus trap + ESC + keyboard navigationni joriy qilish
- [ ] Toastga `aria-live` va semantic role qo'shish
- [ ] Forma validatsiya feedbackini bir xil patternga o'tkazish
- [ ] Desktop + small screen responsive regressionni qayta tekshirish

### WS7 - Performance and Bundle Optimization
- [ ] `exceljs` import strategiyasini optimallashtirish (single strategy, chunk control)
- [ ] Heavy table/lists uchun render va sort complexity optimizatsiyasi
- [ ] Image conversion pipeline memory/CPU optimizatsiyasi
- [ ] Bundle budget va warning threshold policy belgilash
- [ ] Long-running import/sync uchun progress va concurrency tuning

### WS8 - Testing and Quality Gates
- [ ] Unit tests: resolver, dedupe, image pipeline, error normalization
- [ ] Integration tests: register flow, device sync, import flow, rollback path
- [ ] Tauri command tests/smoke: create/test/register/retry/clone
- [ ] E2E smoke tests (critical business flows)
- [ ] CI gates: `npm run typecheck`, `npm run lint`, `npm run build`, `cargo check`, `cargo clippy`

### WS9 - Documentation, Rollout, and Operations
- [ ] `ARCHITECTURE.md` ni real holatga moslab yangilash
- [ ] Incident runbook va rollback playbookni hardening o'zgarishlari bilan yangilash
- [ ] Release notes va migration notes tayyorlash
- [ ] Pilot rollout checklist va post-release monitoring KPIlarini belgilash

## Definition of Done
- [ ] P0/P1 topilmalar yopilgan
- [ ] Lint, typecheck, build, cargo check va cargo clippy yashil
- [ ] Critical flowlarda regression yo'q (manual + automated)
- [ ] Security checklist sign-off olingan
- [ ] UX/a11y acceptance checklist bajarilgan
- [ ] Docs, rollout va rollback hujjatlari yangilangan

## Acceptance Checklist
- [ ] DRY: bir xil business logic bir joyda
- [ ] KISS: har flow uchun bitta canonical path
- [ ] SOLID: page va service boundarylar aniq
- [ ] Best practice: typed contract, safe errors, predictable state
- [ ] UX: consistent feedback, accessible controls, keyboard support
- [ ] Ortiqcha/dublikat kodlar tozalangan

## Suggested Execution Order
1. WS0
2. WS1
3. WS2
4. WS5
5. WS3
6. WS4
7. WS6
8. WS7
9. WS8
10. WS9
