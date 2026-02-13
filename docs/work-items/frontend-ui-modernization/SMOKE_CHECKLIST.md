# SMOKE CHECKLIST

## Frontend UI Modernization - Pilot (V2)

## Environment
1. `apps/frontend/.env`:
   - `VITE_UI_V2_ENABLED=true`
   - `VITE_UI_V2_PAGES=dashboard,students,devices`
   - `VITE_UI_V2_FORCE=false`
2. Backend up and reachable.
3. Test users:
   - `SCHOOL_ADMIN`
   - `TEACHER`
   - `GUARD`

## Auth and Routing
- [ ] Login successful (`/login`)
- [ ] Token bilan protected route ochiladi
- [ ] Logout ishlaydi va login pagega qaytadi
- [ ] Role-based access cheklovlari saqlangan
- [ ] `VITE_UI_V2_ENABLED=false` holatda V2 routega fallback kuzatiladi

## V2 Dashboard
- [ ] `/v2/schools/:schoolId/dashboard` ochiladi
- [ ] Stats kartalari backend bilan mos
- [ ] Period filter ishlaydi (`today/yesterday/week/month/year/custom`)
- [ ] Class filter ishlaydi
- [ ] Custom date oralig'i ishlaydi
- [ ] Realtime SSE event kelganda recent list yangilanadi
- [ ] History modal ochiladi va qidiruv ishlaydi
- [ ] Weekly chart render bo'ladi

## V2 Students
- [ ] `/v2/schools/:schoolId/students` ochiladi
- [ ] Search debounce ishlaydi
- [ ] Class filter ishlaydi
- [ ] Pagination ishlaydi
- [ ] Student create ishlaydi
- [ ] Student edit ishlaydi
- [ ] Student delete ishlaydi
- [ ] Import `.xlsx` ishlaydi
- [ ] Template download ishlaydi
- [ ] Export download ishlaydi
- [ ] Row click student detailga o'tadi

## V2 Devices
- [ ] `/v2/schools/:schoolId/devices` ochiladi
- [ ] Device create ishlaydi
- [ ] Device edit ishlaydi
- [ ] Device delete ishlaydi
- [ ] Online/offline badge logic to'g'ri
- [ ] Webhook in/out URL ko'rinadi
- [ ] Copy action ishlaydi
- [ ] Advanced webhook block toggle ishlaydi

## Performance / Stability
- [ ] Route lazy-loading ishlaydi (network tabda chunk split ko'rinadi)
- [ ] Build successful
- [ ] Console’da critical runtime error yo'q
- [ ] API payload contractlarda regressiya yo'q

## Result
- [ ] PASS
- [ ] FAIL

## Notes
- Tester:
- Date:
- Commit/branch:
- Issues:
