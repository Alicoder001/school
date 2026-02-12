# Student-Registrator Architecture Map (Final)

## Scope
- Module: `apps/student-registrator`
- Stack: React (Vite) + Tauri (Rust)
- Maqsad: Clean Architecture boundary + zero behavior change

## Frontend Ownership
- `src/app` - bootstrap, provider, router
- `src/pages` - route composition
- `src/widgets` - yirik reusable UI bloklar
- `src/features` - user workflow/action
- `src/entities` - domain model mapping
- `src/shared` - http/ipc/media/lib/hooks/types/constants

## Rust Ownership (amaliy)
- `src-tauri/src/main.rs` - invoke registry + app run (kontrakt saqlangan)
- `src-tauri/src/commands.rs` - thin aggregator (include chunk entry)
- `src-tauri/src/interfaces/tauri/commands/*` - command bo'laklari
- `src-tauri/src/hikvision.rs` - thin aggregator
- `src-tauri/src/infrastructure/hikvision/*` - hikvision client chunklari
- `src-tauri/src/storage.rs`, `src-tauri/src/api.rs`, `src-tauri/src/types.rs` - mavjud adapter/type layer (behavior saqlangan)

## IPC Boundary
- React taraf: `src/shared/ipc/*` orqali yagona invoke wrapper
- Rust taraf: command handlerlar tauri invoke contractni saqlaydi
- Saqlangan kontraktlar:
  - `get_devices`, `create_device`, `update_device`, `delete_device`
  - `test_device_connection`, `probe_device_connection`
  - `get_device_capabilities`, `get_device_configuration`, `update_device_configuration`
  - `get_device_webhook_config`, `sync_device_webhook_config`
  - `register_student`
  - `fetch_users`, `delete_user`, `get_user_face`, `get_user_face_by_url`, `recreate_user`
  - `get_provisioning`, `retry_provisioning`
  - `clone_students_to_device`, `clone_device_to_device`
  - `get_contract_version`

## Old -> New Mapping (asosiy)
| Old | New |
|---|---|
| `apps/student-registrator/src/api.ts` | `apps/student-registrator/src/shared/http/*`, `apps/student-registrator/src/shared/ipc/*`, `apps/student-registrator/src/shared/media/*` (+ thin facade) |
| `apps/student-registrator/src/services/excel.service.ts` | `apps/student-registrator/src/shared/excel/{exceljs,parse,template,index}.ts` (+ thin wrapper) |
| `apps/student-registrator/src/pages/DevicesPage.tsx` | `apps/student-registrator/src/pages/devices/*` + orchestrator page |
| `apps/student-registrator/src/pages/StudentsPage.tsx` | `apps/student-registrator/src/pages/students/*` + orchestrator page |
| `apps/student-registrator/src/pages/DeviceDetailPage.tsx` | `apps/student-registrator/src/pages/device-detail/*` + orchestrator page |
| `apps/student-registrator/src-tauri/src/commands.rs` | `apps/student-registrator/src-tauri/src/interfaces/tauri/commands/*` (include orqali) |
| `apps/student-registrator/src-tauri/src/hikvision.rs` | `apps/student-registrator/src-tauri/src/infrastructure/hikvision/*` (include orqali) |

## Compatibility Shimlar
- `apps/student-registrator/src/api.ts` public API saqlangan
- `apps/student-registrator/src/services/excel.service.ts` re-export orqali saqlangan
- Legacy import consumerlar uchun existing pathlar buzilmagan

## Line-Limit Audit
- `apps/student-registrator/src/**` + `apps/student-registrator/src-tauri/src/**` audit natijasi: `ALL_OK`
- 300 dan katta source fayl qolmadi
