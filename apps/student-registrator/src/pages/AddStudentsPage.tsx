import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  fetchSchools,
  fetchClasses,
  createClass,
  fetchSchoolDevices,
  fetchDevices,
  fetchUsers,
  getUserFace,
  testDeviceConnection,
  getAuthUser,
} from '../api';
import { useStudentTable } from '../hooks/useStudentTable';
import { useExcelImport } from '../hooks/useExcelImport';
import { useGlobalToast } from '../hooks/useToast';
import { StudentTable } from '../components/students/StudentTable';
import { ExcelImportButton } from '../components/students/ExcelImportButton';
import { ImportMappingPanel } from '../components/students/ImportMappingPanel';
import { ProvisioningPanel } from '../components/students/ProvisioningPanel';
import type { DeviceStatus } from '../components/students/DeviceTargetsPanel';
import { TemplateDownloadModal } from '../components/students/TemplateDownloadModal';
import { downloadStudentsTemplate } from '../services/excel.service';
import { Icons } from '../components/ui/Icons';
import type { ClassInfo, DeviceConfig, SchoolDeviceInfo } from '../types';

export function AddStudentsPage() {
  const [availableClasses, setAvailableClasses] = useState<ClassInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDeviceImporting, setIsDeviceImporting] = useState(false);
  const [backendDevices, setBackendDevices] = useState<SchoolDeviceInfo[]>([]);
  const [credentials, setCredentials] = useState<DeviceConfig[]>([]);
  const [deviceStatus, setDeviceStatus] = useState<Record<string, DeviceStatus>>({});
  const [deviceStatusLoading, setDeviceStatusLoading] = useState(false);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [deviceSelectionTouched, setDeviceSelectionTouched] = useState(false);
  const [isDeviceDropdownOpen, setIsDeviceDropdownOpen] = useState(false);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState<number>(1);
  const [isCreatingClass, setIsCreatingClass] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isProvModalOpen, setIsProvModalOpen] = useState(false);
  const [sourceImportDeviceId, setSourceImportDeviceId] = useState('');
  const [refreshingFaceIds, setRefreshingFaceIds] = useState<string[]>([]);
  const [isSourceImportModalOpen, setIsSourceImportModalOpen] = useState(false);
  const [sourceImportDeviceIds, setSourceImportDeviceIds] = useState<string[]>([]);
  const [isTargetSaveModalOpen, setIsTargetSaveModalOpen] = useState(false);

  const resolveDeviceLabel = useCallback((input: string) => {
    if (!backendDevices.length) return input;
    const byId = new Map(backendDevices.map((d) => [d.id, d.name]));
    return input.replace(/Backend ([a-f0-9-]{36})/gi, (full, id) => {
      const name = byId.get(id);
      if (!name) return full;
      return name;
    });
  }, [backendDevices]);

  const {
    students,
    addStudent,
    updateStudent,
    deleteStudent,
    importStudents,
    applyClassMapping,
    saveStudent,
    saveAllPending,
    isSaving,
    lastRegisterResult,
    lastProvisioningId,
  } = useStudentTable({ resolveDeviceLabel });

  const { parseExcel, resizeImages } = useExcelImport();
  const { addToast } = useGlobalToast();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('.device-select')) return;
      setIsDeviceDropdownOpen(false);
    };
    if (isDeviceDropdownOpen) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isDeviceDropdownOpen]);

  const refreshDeviceStatuses = useCallback(async (
    backendList: SchoolDeviceInfo[],
    localList?: DeviceConfig[],
  ) => {
    if (backendList.length === 0) {
      setDeviceStatus({});
      return;
    }

    const normalize = (value?: string | null) => (value || '').trim().toLowerCase();
    const isCredentialsExpired = (device?: DeviceConfig | null) => {
      if (!device?.credentialsExpiresAt) return false;
      const expires = new Date(device.credentialsExpiresAt).getTime();
      if (Number.isNaN(expires)) return false;
      return Date.now() > expires;
    };

    setDeviceStatusLoading(true);
    try {
      const local = localList ?? await fetchDevices();
      if (!localList) setCredentials(local);

      const byBackendId = new Map<string, DeviceConfig>();
      const byDeviceId = new Map<string, DeviceConfig>();
      local.forEach((device) => {
        if (device.backendId) byBackendId.set(device.backendId, device);
        if (device.deviceId) byDeviceId.set(normalize(device.deviceId), device);
      });

      const results = await Promise.all(
        backendList.map(async (device) => {
          const localDevice =
            byBackendId.get(device.id) ||
            (device.deviceId ? byDeviceId.get(normalize(device.deviceId)) : undefined);
          if (!localDevice || isCredentialsExpired(localDevice)) {
            return { backendId: device.id, status: 'unknown' as DeviceStatus };
          }
          try {
            const result = await testDeviceConnection(localDevice.id);
            return { backendId: device.id, status: (result.ok ? 'online' : 'offline') as DeviceStatus };
          } catch (err) {
            return { backendId: device.id, status: 'offline' as DeviceStatus };
          }
        }),
      );

      const nextStatus: Record<string, DeviceStatus> = {};
      results.forEach((item) => {
        nextStatus[item.backendId] = item.status;
      });
      setDeviceStatus(nextStatus);
    } catch (err) {
      console.error('Failed to refresh device status:', err);
      addToast('Qurilma holatini tekshirishda xato', 'error');
    } finally {
      setDeviceStatusLoading(false);
    }
  }, [addToast]);

  const handleToggleDevice = (deviceId: string) => {
    setDeviceSelectionTouched(true);
    setSelectedDeviceIds((prev) =>
      prev.includes(deviceId) ? prev.filter((id) => id !== deviceId) : [...prev, deviceId],
    );
  };

  const handleToggleAllDevices = (next: boolean) => {
    setDeviceSelectionTouched(true);
    setSelectedDeviceIds(next ? backendDevices.map((d) => d.id) : []);
  };

  // Load school and classes
  useEffect(() => {
    const loadData = async () => {
      const user = getAuthUser();
      if (!user) return;

      try {
        let schoolId = user.schoolId;
        if (!schoolId) {
          const schools = await fetchSchools();
          schoolId = schools[0]?.id;
        }
        
        if (schoolId) {
          const [classes, devices, local] = await Promise.all([
            fetchClasses(schoolId),
            fetchSchoolDevices(schoolId),
            fetchDevices(),
          ]);
          console.log('[AddStudents] Loaded classes from backend:', classes);
          setAvailableClasses(classes);
          setBackendDevices(devices);
          setCredentials(local);
          await refreshDeviceStatuses(devices, local);
        }
      } catch (err) {
        console.error('Failed to load data:', err);
        const message = err instanceof Error ? err.message : 'Ma\'lumotlarni yuklashda xato';
        addToast(message, 'error');
      }
    };

    loadData();
  }, [addToast, refreshDeviceStatuses]);

  useEffect(() => {
    if (!deviceSelectionTouched) {
      setSelectedDeviceIds(backendDevices.map((d) => d.id));
    }
  }, [backendDevices, deviceSelectionTouched]);

  // Handle Excel import
  const handleExcelImport = async (file: File) => {
    console.log('[Excel Import] Starting with availableClasses:', availableClasses);
    
    if (availableClasses.length === 0) {
      addToast('Sinflar yuklanmagan! Sahifani yangilang.', 'error');
      return;
    }
    
    setLoading(true);
    try {
      const rows = await parseExcel(file, availableClasses);
      const resized = await resizeImages(rows);
      
      // Check if all rows have classId
      const withoutClass = resized.filter(r => !r.classId);
      if (withoutClass.length > 0) {
        const missingNames = withoutClass.map((r) => `${r.lastName || ''} ${r.firstName || ''}`.trim());
        console.warn('[Excel Import] Rows without classId:', missingNames);
        addToast(`${withoutClass.length} ta o'quvchining sinfi topilmadi!`, 'error');
      }
      
      importStudents(resized);
      addToast(`${resized.length} ta o'quvchi yuklandi`, 'success');
    } catch (err) {
      console.error('Excel import error:', err);
      addToast('Excel yuklashda xato', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateDownload = async (classNames: string[]) => {
    try {
      await downloadStudentsTemplate(classNames);
      addToast('Shablon yuklandi', 'success');
    } catch (err) {
      console.error('Template download error:', err);
      addToast('Shablon yuklashda xato', 'error');
    }
  };

  // Handle save student
  const handleSaveStudent = async (id: string) => {
    try {
      await saveStudent(id, selectedDeviceIds);
      addToast('O\'quvchi saqlandi', 'success');
    } catch (err: any) {
      // Check if it's validation error
      const errorMsg = err?.message || 'Saqlashda xato';
      addToast(errorMsg, 'error');
    }
  };

  // Handle save all
  const handleSaveAll = async () => {
    setIsTargetSaveModalOpen(true);
  };

  const handleConfirmSaveAll = async () => {
    const pendingCount = students.filter(s => s.status === 'pending').length;
    if (pendingCount === 0) {
      addToast('Saqlanishi kerak bo\'lgan o\'quvchilar yo\'q', 'error');
      return;
    }

    try {
      const { successCount, errorCount, errorReasons } = await saveAllPending(selectedDeviceIds);
      if (errorCount > 0) {
        const firstReason = Object.entries(errorReasons).sort((a, b) => b[1] - a[1])[0]?.[0];
        addToast(
          firstReason
            ? `${errorCount} ta xato, ${successCount} ta saqlandi. Asosiy sabab: ${firstReason}`
            : `${errorCount} ta xato, ${successCount} ta saqlandi`,
          'error',
        );
        return;
      }
      addToast(`${successCount} ta o'quvchi saqlandi`, 'success');
      setIsTargetSaveModalOpen(false);
    } catch (err) {
      addToast('Ba\'zi o\'quvchilarni saqlashda xato', 'error');
    }
  };

  const pendingCount = students.filter(s => s.status === 'pending').length;
  const successCount = students.filter(s => s.status === 'success').length;
  const errorCount = students.filter(s => s.status === 'error').length;
  const errorRows = useMemo(
    () =>
      students
        .map((student, index) => ({ student, index: index + 1 }))
        .filter((item) => item.student.status === 'error'),
    [students],
  );

  // Add empty row handler
  const handleAddRow = () => {
    addStudent({
      firstName: '',
      lastName: '',
      fatherName: undefined,
      gender: 'male',
      classId: undefined,
      className: undefined,
      parentPhone: undefined,
      imageBase64: undefined,
    });
  };

  const handleApplyMapping = (className: string, classId: string) => {
    if (!classId) return;
    const selectedClass = availableClasses.find((cls) => cls.id === classId);
    applyClassMapping(className, classId, selectedClass?.name);
  };

  const createClassAndAppend = async (params: {
    className: string;
    gradeLevel: number;
  }) => {
    const user = getAuthUser();
    const schoolId = user?.schoolId;
    if (!schoolId) {
      addToast('Maktab aniqlanmadi. Qayta login qiling.', 'error');
      return null;
    }

    const className = params.className.trim().toUpperCase();
    const gradeLevel = Number(params.gradeLevel);
    if (!className) {
      addToast('Sinf nomi majburiy', 'error');
      return null;
    }
    if (!Number.isFinite(gradeLevel) || gradeLevel < 1 || gradeLevel > 11) {
      addToast('Sinf darajasi 1 dan 11 gacha bo\'lishi kerak', 'error');
      return null;
    }

    try {
      const created = await createClass(schoolId, className, gradeLevel);
      setAvailableClasses((prev) => {
        const next = [...prev, created];
        return next.sort((a, b) => {
          if (a.gradeLevel !== b.gradeLevel) return a.gradeLevel - b.gradeLevel;
          return a.name.localeCompare(b.name);
        });
      });
      addToast(`Sinf yaratildi: ${created.name}`, 'success');
      return created;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sinf yaratishda xato';
      addToast(message, 'error');
      return null;
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingClass(true);
    try {
      const created = await createClassAndAppend({
        className: newClassName,
        gradeLevel: newClassGrade,
      });
      if (!created) return;
      setIsClassModalOpen(false);
      setNewClassName('');
      setNewClassGrade(1);
    } finally {
      setIsCreatingClass(false);
    }
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const getFaceWithRetry = useCallback(
    async (localDeviceId: string, employeeNo: string, attempts = 3): Promise<string | undefined> => {
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
          const face = await getUserFace(localDeviceId, employeeNo);
          return face.imageBase64 || undefined;
        } catch {
          if (attempt < attempts) {
            await sleep(250 * attempt);
          }
        }
      }
      return undefined;
    },
    [],
  );

  const findLocalByBackendDeviceId = useCallback((backendId?: string) => {
    if (!backendId) return null;
    const backendDevice = backendDevices.find((d) => d.id === backendId);
    const normalizedExternalId = (backendDevice?.deviceId || '').trim().toLowerCase();
    return (
      credentials.find((item) => item.backendId === backendId) ||
      credentials.find((item) => (item.deviceId || '').trim().toLowerCase() === normalizedExternalId) ||
      null
    );
  }, [backendDevices, credentials]);

  const refreshFaceForStudent = useCallback(async (studentId: string): Promise<boolean> => {
    const row = students.find((item) => item.id === studentId);
    if (!row?.deviceStudentId) {
      addToast('Bu qator uchun device student ID topilmadi', 'error');
      return false;
    }
    const localDevice = findLocalByBackendDeviceId(row.sourceDeviceBackendId || sourceImportDeviceId || selectedDeviceIds[0]);
    if (!localDevice?.id) {
      addToast("Face refresh uchun local credentials topilmadi", 'error');
      return false;
    }
    setRefreshingFaceIds((prev) => (prev.includes(studentId) ? prev : [...prev, studentId]));
    try {
      const imageBase64 = await getFaceWithRetry(localDevice.id, row.deviceStudentId, 3);
      if (!imageBase64) throw new Error("Qurilmadan rasmni olib bo'lmadi");
      updateStudent(studentId, { imageBase64 });
      addToast('Rasm yangilandi', 'success');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Rasmni yangilashda xato';
      addToast(message, 'error');
      return false;
    } finally {
      setRefreshingFaceIds((prev) => prev.filter((id) => id !== studentId));
    }
  }, [students, addToast, findLocalByBackendDeviceId, sourceImportDeviceId, selectedDeviceIds, updateStudent, getFaceWithRetry]);

  const refreshAllMissingFaces = useCallback(async () => {
    const targetRows = students.filter(
      (item) => item.source === 'import' && !item.imageBase64 && Boolean(item.deviceStudentId),
    );
    if (targetRows.length === 0) {
      addToast("Rasm yangilash uchun mos qator topilmadi", 'error');
      return;
    }
    let success = 0;
    let failed = 0;
    for (const row of targetRows) {
      const ok = await refreshFaceForStudent(row.id);
      if (ok) {
        success += 1;
      } else {
        failed += 1;
      }
    }
    addToast(`Rasm refresh yakunlandi: ${success} success, ${failed} failed`, failed > 0 ? 'error' : 'success');
  }, [students, addToast, refreshFaceForStudent]);

  const splitName = (value: string) => {
    const cleaned = (value || '').trim();
    if (!cleaned) return { firstName: '', lastName: '' };
    const parts = cleaned.split(/\s+/);
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };
    return { lastName: parts[0], firstName: parts.slice(1).join(' ') };
  };

  const openDeviceModeImportModal = () => {
    if (backendDevices.length === 0) {
      addToast('Device mode import uchun qurilma tanlanmagan', 'error');
      return;
    }
    const defaults = sourceImportDeviceIds.length > 0
      ? sourceImportDeviceIds
      : (selectedDeviceIds.length > 0 ? selectedDeviceIds : [backendDevices[0].id]);
    setSourceImportDeviceIds(defaults);
    setIsSourceImportModalOpen(true);
  };

  const handleConfirmDeviceModeImport = async () => {
    if (sourceImportDeviceIds.length === 0) {
      addToast('Manba qurilmalarni tanlang', 'error');
      return;
    }

    setSourceImportDeviceId(sourceImportDeviceIds[0] || '');
    setIsDeviceImporting(true);
    try {
      const collected: Array<{
        employeeNo: string;
        name: string;
        gender?: string;
        numOfFace?: number;
        sourceBackendId: string;
      }> = [];
      const unresolvedSources: string[] = [];
      for (const backendId of sourceImportDeviceIds) {
        const backendDevice = backendDevices.find((d) => d.id === backendId);
        const normalizedExternalId = (backendDevice?.deviceId || '').trim().toLowerCase();
        const localDevice =
          credentials.find((item) => item.backendId === backendId) ||
          credentials.find((item) => (item.deviceId || '').trim().toLowerCase() === normalizedExternalId);

        if (!localDevice?.id) {
          unresolvedSources.push(backendDevice?.name || backendId);
          continue;
        }

        let offset = 0;
        const limit = 100;
        for (;;) {
          const result = await fetchUsers(localDevice.id, { offset, limit });
          const list = result.UserInfoSearch?.UserInfo || [];
          const total = result.UserInfoSearch?.totalMatches || 0;
          if (list.length === 0) break;
          collected.push(
            ...list.map((item) => ({
              employeeNo: item.employeeNo || '',
              name: item.name || '',
              gender: item.gender,
              numOfFace: item.numOfFace,
              sourceBackendId: backendId,
            })),
          );
          offset += list.length;
          if (offset >= total) break;
        }
      }

      if (collected.length === 0) {
        if (unresolvedSources.length > 0) {
          addToast(`Local credentials topilmadi: ${unresolvedSources.join(', ')}`, 'error');
        } else {
          addToast('Tanlangan qurilmalarda user topilmadi', 'error');
        }
        return;
      }

      const uniq = new Map<string, {
        employeeNo: string;
        name: string;
        gender?: string;
        numOfFace?: number;
        sourceBackendId: string;
      }>();
      for (const item of collected) {
        const key = `${item.employeeNo}::${item.name}`.toLowerCase();
        if (!uniq.has(key)) uniq.set(key, item);
      }
      const merged = Array.from(uniq.values());

      if (merged.length === 0) {
        addToast('Tanlangan qurilmada user topilmadi', 'error');
        return;
      }

      const rows = merged.map((item) => {
        const parsed = splitName(item.name);
        const lowerGender = String(item.gender || '').toLowerCase();
        const gender = lowerGender.startsWith('f') ? 'female' : 'male';
        return {
          firstName: parsed.firstName,
          lastName: parsed.lastName,
          fatherName: undefined,
          gender,
          classId: undefined,
          className: undefined,
          parentPhone: undefined,
          imageBase64: undefined as string | undefined,
          deviceStudentId: item.employeeNo,
          sourceDeviceBackendId: item.sourceBackendId,
        };
      });

      const importedRows = importStudents(rows);
      const candidates = importedRows.filter((row) =>
        Boolean(row.deviceStudentId) &&
        merged.some((item) => item.employeeNo === row.deviceStudentId && (item.numOfFace || 0) > 0),
      );

      if (candidates.length === 0) {
        addToast(`${rows.length} ta user yuklandi. Rasm mavjud emas`, 'success');
        return;
      }

      setRefreshingFaceIds((prev) => [...new Set([...prev, ...candidates.map((row) => row.id)])]);
      addToast(`${rows.length} ta user yuklandi. Rasmlar fon rejimida olinmoqda...`, 'success');

      const concurrency = 4;
      let cursor = 0;
      let pulled = 0;

      const worker = async () => {
        while (cursor < candidates.length) {
          const idx = cursor;
          cursor += 1;
          const row = candidates[idx];
          const employeeNo = row.deviceStudentId || '';
          const localForRow = findLocalByBackendDeviceId(row.sourceDeviceBackendId || sourceImportDeviceIds[0]);
          if (!localForRow?.id) {
            setRefreshingFaceIds((prev) => prev.filter((id) => id !== row.id));
            continue;
          }
          const imageBase64 = await getFaceWithRetry(localForRow.id, employeeNo, 3);
          if (imageBase64) {
            updateStudent(row.id, { imageBase64 });
            pulled += 1;
          }
          setRefreshingFaceIds((prev) => prev.filter((id) => id !== row.id));
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(concurrency, candidates.length) }, () => worker()),
      );
      addToast(
        `Rasm yuklash yakunlandi: ${pulled} ta muvaffaqiyatli, ${candidates.length - pulled} ta muvaffaqiyatsiz`,
        pulled < candidates.length ? 'error' : 'success',
      );
      setIsSourceImportModalOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Device mode importda xato';
      addToast(message, 'error');
    } finally {
      setIsDeviceImporting(false);
    }
  };

  return (
    <div className="page">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">O'quvchilar qo'shish</h1>
          <p className="page-description">
            Jadvalni to'ldiring yoki Excel yuklang
          </p>
        </div>

        <div className="page-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setIsClassModalOpen(true)}
            title="Yangi sinf qo'shish"
          >
            <Icons.Plus /> Sinf qo'shish
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={openDeviceModeImportModal}
            disabled={backendDevices.length === 0 || isDeviceImporting}
            title="Qurilmadan jadvalga import (device mode)"
          >
            <Icons.Download /> {isDeviceImporting ? 'Device import...' : 'Device mode import'}
          </button>
          <div className="device-select">
            <button
              type="button"
              className="device-select-trigger"
              onClick={() => setIsDeviceDropdownOpen((prev) => !prev)}
              title="Qurilma tanlovi"
            >
              <Icons.Monitor />
              <span>Qurilmalar ({selectedDeviceIds.length}/{backendDevices.length})</span>
              <Icons.ChevronDown />
            </button>
            {isDeviceDropdownOpen && (
              <div className="device-select-menu">
                <div className="device-select-header">
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={backendDevices.length > 0 && selectedDeviceIds.length === backendDevices.length}
                      onChange={(e) => handleToggleAllDevices(e.target.checked)}
                    />
                    <span>Barchasi</span>
                  </label>
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => refreshDeviceStatuses(backendDevices, credentials)}
                    disabled={deviceStatusLoading || backendDevices.length === 0}
                    title="Yangilash"
                    aria-label="Yangilash"
                  >
                    <Icons.Refresh />
                  </button>
                </div>
                <div className="device-select-list">
                  {backendDevices.length === 0 && (
                    <div className="device-select-empty">Qurilmalar topilmadi</div>
                  )}
                  {backendDevices.map((device) => {
                    const status = deviceStatus[device.id] || 'unknown';
                    const isSelected = selectedDeviceIds.includes(device.id);
                    return (
                      <label key={device.id} className="device-select-item">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleDevice(device.id)}
                        />
                        <span className="device-select-name">{device.name}</span>
                        <span
                          className={`badge ${
                            status === 'online'
                              ? 'badge-success'
                              : status === 'offline'
                              ? 'badge-danger'
                              : ''
                          }`}
                        >
                          {status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : "Sozlanmagan"}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <ExcelImportButton 
            onImport={handleExcelImport} 
            disabled={loading}
          />
          <button
            type="button"
            className="device-select-trigger"
            onClick={() => setIsTemplateModalOpen(true)}
            disabled={loading}
            title="Shablon yuklash"
            aria-label="Shablon yuklash"
          >
            <Icons.Download />
            <span>Shablon yuklash</span>
          </button>

          {pendingCount > 0 && (
            <button 
              className="button button-success" 
              onClick={handleSaveAll}
              disabled={isSaving}
            >
              <Icons.Save /> Barchasini Saqlash ({pendingCount})
            </button>
          )}

          {lastProvisioningId && (
            <button
              type="button"
              className="btn-icon"
              onClick={() => setIsProvModalOpen(true)}
              title="Provisioning holatini ko'rish"
            >
              <Icons.Refresh />
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      {students.length > 0 && (
        <div className="stats-bar">
          <div className="stat-item">
            <span className="stat-label">Jami:</span>
            <span className="stat-value">{students.length}</span>
          </div>
          <div className="stat-item stat-warning">
            <span className="stat-label">Kutilmoqda:</span>
            <span className="stat-value">{pendingCount}</span>
          </div>
          <div className="stat-item stat-success">
            <span className="stat-label">Saqlandi:</span>
            <span className="stat-value">{successCount}</span>
          </div>
          {errorCount > 0 && (
            <div className="stat-item stat-danger">
              <span className="stat-label">Xato:</span>
              <span className="stat-value">{errorCount}</span>
            </div>
          )}
        </div>
      )}

      {errorRows.length > 0 && (
        <div className="notice notice-error">
          <strong>Xatolar tafsiloti:</strong>
          <div className="error-summary-list">
            {errorRows.map(({ student, index }) => {
              const name = `${student.lastName || ''} ${student.firstName || ''}`.trim() || `Qator ${index}`;
              return (
                <div key={student.id} className="error-summary-item">
                  <span className="error-summary-name">
                    #{index} {name}
                  </span>
                  <span className="error-summary-message">
                    {student.error || "Noma'lum xato"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ImportMappingPanel
        students={students}
        availableClasses={availableClasses}
        onApplyMapping={handleApplyMapping}
      />

      {/* Provisioning Modal */}
      {isProvModalOpen && (
        <div className="modal-overlay" onClick={() => setIsProvModalOpen(false)}>
          <div className="modal modal-provisioning" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Provisioning Holati</h3>
                {lastProvisioningId && (
                  <p className="text-secondary text-xs">ID: {lastProvisioningId}</p>
                )}
              </div>
              <button className="modal-close" onClick={() => setIsProvModalOpen(false)}>
                <Icons.X />
              </button>
            </div>
            <div className="modal-body">
              <ProvisioningPanel
                provisioningId={lastProvisioningId}
                registerResult={lastRegisterResult}
              />
            </div>
            <div className="modal-footer">
              <button 
                className="button button-secondary" 
                onClick={() => setIsProvModalOpen(false)}
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}

      {isSourceImportModalOpen && (
        <div className="modal-overlay" onClick={() => !isDeviceImporting && setIsSourceImportModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Device mode import: manba qurilmalar</h3>
              <button
                className="modal-close"
                onClick={() => !isDeviceImporting && setIsSourceImportModalOpen(false)}
                disabled={isDeviceImporting}
              >
                <Icons.X />
              </button>
            </div>
            <div className="modal-body">
              <div className="device-list">
                {backendDevices.map((device) => {
                  const checked = sourceImportDeviceIds.includes(device.id);
                  return (
                    <label key={device.id} className="device-item" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSourceImportDeviceIds((prev) =>
                            checked ? prev.filter((id) => id !== device.id) : [...prev, device.id],
                          )
                        }
                        disabled={isDeviceImporting}
                      />
                      <span>{device.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="button button-primary"
                onClick={handleConfirmDeviceModeImport}
                disabled={isDeviceImporting || sourceImportDeviceIds.length === 0}
              >
                {isDeviceImporting ? 'Import qilinmoqda...' : 'Importni boshlash'}
              </button>
              <button
                className="button button-secondary"
                onClick={() => setIsSourceImportModalOpen(false)}
                disabled={isDeviceImporting}
              >
                Bekor qilish
              </button>
            </div>
          </div>
        </div>
      )}

      {isTargetSaveModalOpen && (
        <div className="modal-overlay" onClick={() => !isSaving && setIsTargetSaveModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Saqlash: target qurilmalar</h3>
              <button
                className="modal-close"
                onClick={() => !isSaving && setIsTargetSaveModalOpen(false)}
                disabled={isSaving}
              >
                <Icons.X />
              </button>
            </div>
            <div className="modal-body">
              <div className="device-list">
                {backendDevices.map((device) => {
                  const checked = selectedDeviceIds.includes(device.id);
                  const status = deviceStatus[device.id] || 'unknown';
                  return (
                    <label key={device.id} className="device-item" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleDevice(device.id)}
                        disabled={isSaving}
                      />
                      <span>{device.name}</span>
                      <span className={`badge ${
                        status === 'online' ? 'badge-success' : status === 'offline' ? 'badge-danger' : ''
                      }`}>
                        {status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : "Sozlanmagan"}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="button button-primary"
                onClick={handleConfirmSaveAll}
                disabled={isSaving}
              >
                {isSaving ? 'Saqlanmoqda...' : 'Saqlashni boshlash'}
              </button>
              <button
                className="button button-secondary"
                onClick={() => setIsTargetSaveModalOpen(false)}
                disabled={isSaving}
              >
                Bekor qilish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="page-content">
        <StudentTable
          students={students}
          availableClasses={availableClasses}
          onEdit={updateStudent}
          onDelete={(id) => {
            deleteStudent(id);
            addToast('O\'quvchi o\'chirildi', 'success');
          }}
          onSave={handleSaveStudent}
          onRefreshFace={refreshFaceForStudent}
          refreshingFaceIds={refreshingFaceIds}
          onAddRow={handleAddRow}
        />
      </div>

      {isClassModalOpen && (
        <div className="modal-overlay" onClick={() => setIsClassModalOpen(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Yangi sinf qo'shish</h3>
              <button
                className="modal-close"
                onClick={() => setIsClassModalOpen(false)}
                title="Yopish"
              >
                <Icons.X />
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleCreateClass}>
                <div className="form-group">
                  <label>Sinf nomi</label>
                  <input
                    className="input"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    placeholder="Masalan: 9C"
                    autoFocus
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Sinf darajasi</label>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={11}
                    value={newClassGrade}
                    onChange={(e) => setNewClassGrade(Number(e.target.value))}
                    required
                  />
                </div>
                <div className="form-actions">
                  <button className="button button-primary" type="submit" disabled={isCreatingClass}>
                    <Icons.Check /> {isCreatingClass ? 'Yaratilmoqda...' : 'Yaratish'}
                  </button>
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => setIsClassModalOpen(false)}
                    disabled={isCreatingClass}
                  >
                    <Icons.X /> Bekor qilish
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <TemplateDownloadModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        availableClasses={availableClasses}
        onDownload={handleTemplateDownload}
      />
    </div>
  );
}
