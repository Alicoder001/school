# Legacy Path Policy

## Canonical Source of Truth

- Backend canonical source: `apps/backend/**`
- Web frontend canonical source: `apps/frontend/**`

## Legacy Paths (Do Not Evolve)

- `frontend/**` katalogi legacy wrapper sifatida qoldirilgan.
  - Scriptlar `apps/frontend`ga delegatsiya qiladi.
- Root backend source pathlar (`server.ts`, `src/**`, `prisma/**`, `scripts/**`) legacy transition qatlamida turibdi.
  - Operational commandlar rootdan `apps/backend`ga delegatsiya qilingan.

## Rule

- Yangi o'zgarishlar faqat `apps/backend/**` va `apps/frontend/**` ichida qilinadi.
- Legacy pathlar faqat backward-compat uchun saqlanadi; feature/refactor kiritilmaydi.

## Operational Note

- Docker runtime verify local muhitda `docker` mavjud bo'lganda alohida bajariladi.

