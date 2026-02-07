# TASKS

## Hikvision Device Management UX

## Epic 1 - Discovery and Alignment
- [x] Current flow diagram (UI/Tauri/Backend) chizish
- [x] Device onboarding pain-point list va baseline metrics yig'ish
- [x] API contract draft tayyorlash (request/response/error)
- [x] Conflict policy (`deviceId` cross-school) bo'yicha qaror
- [x] Security checklist (credentials, webhook secret, logging) yakunlash

## Epic 2 - Unified Add/Connect Flow
- [x] `DevicesPage`da add + credentials flowni birlashtirish
- [x] Manual `deviceId`ni optional qilish
- [x] Connection test natijasini wizard ichida ko'rsatish
- [x] `deviceId` discovered bo'lsa backendga auto sync qilish
- [x] Existing local credentialni backend devicega auto-link qilish
- [x] UX states: idle/loading/success/error
- [x] Inline validation: host/port/login/password
- [x] Success toast + error toastni standartlashtirish

## Epic 3 - Routing and Device Detail Page
- [x] Route qo'shish: `/devices/:id`
- [x] Devices listdan detailga o'tish CTA qo'shish
- [x] Device detail layout (desktop/mobile responsive)
- [x] Overview tab (identity/status/lastSeen)
- [x] Configuration tab (name/type/location/device info)
- [x] Sync tab (clone actions)ni detailga ko'chirish/yangilash

## Epic 4 - Device Users Management
- [x] Device users fetch/search UI
- [x] User detail modal/drawer
- [x] Recreate/edit flow (face handling bilan)
- [x] Delete user confirmation flow
- [x] Error mapping (duplicate/not found/upload failed)
- [x] Paginated or incremental loading strategy

## Epic 5 - Webhook Management
- [x] Webhook sectionni detailga ko'chirish
- [x] In/Out URL copy UX
- [x] Secret reveal/hide UX
- [x] Secret rotate action (API + UI)
- [x] Webhook test action (API + UI)
- [x] Webhook health indicator (last event received)

## Epic 6 - Backend and Contract Updates
- [x] Device create/update endpointlarda optional/auto `deviceId` oqimini tekislash
- [x] `deviceId` conflict uchun explicit 409 response qo'shish
- [x] Webhook rotate endpoint qo'shish
- [x] Webhook test endpoint qo'shish
- [x] Audit log events qo'shish (rotate/test/connect)
- [x] Response schema documentation yangilash

## Epic 7 - Security and Hardening
- [x] Hikvision debug loggingni production-safe qilish
- [x] Local credential storage hardening plan (phase-2 encryption)
- [x] Webhook secret handling policyni implement qilish
- [x] Provisioning auth tekshiruvlarini qayta ko'rib chiqish

## Epic 8 - QA and Release
- [x] Test matrix: happy path, negative path, edge cases
- [x] Manual QA pass (onboarding, detail, users, webhook)
- [x] Regression pass (clone/provisioning)
- [x] Pilot rollout checklist tayyorlash
- [x] Rollback playbook tayyorlash
- [x] Release notes yozish

## Epic 9 - Capability-Driven Configuration (Standard-Compliant 100%)
- [x] Hikvision capability probing layer implement qilish
- [x] Capability matrix (model/firmware x feature) hujjatlashtirish
- [x] Configuration tab full CRUD (general settings)
- [x] Configuration tab full CRUD (time/NTP settings)
- [x] Configuration tab full CRUD (network settings where supported)
- [x] Unsupported capability uchun safe read-only fallback UI
- [x] Write operations uchun pre-flight validation pipeline
- [x] Rollback snapshot before config write

## Epic 10 - Operations, SLO, and Compliance
- [x] Structured logging va request correlation id kengaytirish
- [x] Device operation metrics (success/failure/latency) qo'shish
- [x] SLO targetlar belgilash va dashboard spec yozish
- [x] Incident response runbook tayyorlash
- [x] Security sign-off checklist (must-have) yakunlash
- [x] UAT sign-off (school admin real workflow)

## Acceptance Checklist
- [x] Operator manual `deviceId`siz yangi qurilma qo'sha oladi
- [x] Device detail sahifasi orqali asosiy boshqaruv amallari bajariladi
- [x] Webhook setup/test desktop ichida yakunlanadi
- [x] User management stable ishlaydi
- [x] Critical flowlarda blocker bug yo'q
- [x] Capability-driven config full flow production-ready
- [x] Operations + SLO + compliance artifacts completed

## Addendum - Device User UX/Sync Deepening
- [x] Users list default minimal fields (name, employeeNo, gender, hasFace)
- [x] Student DB detail lazy-load: only row clickda backenddan olinadi
- [x] Pagination state explicit: loaded/total va load-more control
- [x] `deviceStudentId` bo'yicha school-scoped backend lookup endpoint qo'shildi
- [x] Edit flow DB + device uchun kompensatsion tranzaksiya (rollback on device failure)
- [x] Device image early-load yo'q: detail panelda DB photo preview only when opened

## Epic 11 - Device User Import Wizard (Excel-Style)
- [ ] Device usersni staging ro'yxatga yuklash (`employeeNo`, `name`, `gender`, `hasFace`)
- [ ] Import preview panel (create/update/skip estimatsiya)
- [ ] Mapping table (firstName, lastName, fatherName, classId, parentPhone) qo'lda to'ldirish
- [ ] Validation pipeline (required fields, class exists, duplicate policy)
- [ ] Batch commit (`create/update`) transactional qilib yozish
- [ ] Import natija hisobotini chiqarish (`created/updated/skipped/failed`)
- [ ] Import audit log (`who/when/sourceDevice/result`)

## Epic 12 - Device Face Pull and URL Storage
- [ ] Tauri command: device'dan mavjud user rasmini olish (`employeeNo -> faceURL -> bytes`)
- [ ] UI action: "Qurilmadan rasmni sync qilish"
- [ ] Serverga rasm upload qilish va `photoUrl` olish
- [ ] DB'da faqat `photoUrl` saqlash (binary/base64 saqlamaslik)
- [ ] Rasm yo'q/auth fail/error holatlarini aniq ko'rsatish
- [ ] Retry action (single user va batch)

## Epic 13 - Save Policy with Target Device Selection
- [ ] Save vaqtida `syncMode` tanlash: `none | current | all | selected`
- [ ] `selected` mode uchun multi-select device picker
- [ ] Device status ko'rsatish (`online/offline/no credentials`)
- [ ] Backend contractga `syncMode` va `targetDeviceIds` qo'shish
- [ ] Per-device natija qaytarish (`SUCCESS/FAILED/SKIPPED`)
- [ ] Partial failure UX (DB saved + device fail) va retry queue

## Epic 14 - Sync Consistency, Jobs, and Observability
- [ ] Import/sync job model (queue + status + retryCount + lastError)
- [ ] Idempotency key (double-submit oldini olish)
- [ ] Concurrency lock (`student/device` level) race conditiondan himoya
- [ ] Structured audit trail (`before/after`, actor, target devices)
- [ ] Metrics: sync success rate, mean sync latency, retry rate
- [ ] Incident playbook update (device sync failure triage)

## Expanded Acceptance Checklist (New Scope)
- [ ] Operator qurilmadan userlarni Excel-style jadvalga import qila oladi
- [ ] Qo'lda to'ldirishdan keyin DB ga batch saqlash ishlaydi
- [ ] Qurilmadagi mavjud rasmni olib serverga joylab `photoUrl`ga bog'lash ishlaydi
- [ ] Save paytida qaysi devicelarga yuborish tanlanadi
- [ ] Har bir target device bo'yicha alohida natija ko'rinadi
- [ ] Partial failure holatida retry bilan tiklash mumkin
