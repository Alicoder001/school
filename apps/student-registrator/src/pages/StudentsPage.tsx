import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  checkStudentOnDevice,
  fetchClasses,
  fetchDevices,
  fetchStudentDiagnostics,
  fetchSchoolDevices,
  getAuthUser,
  updateStudentProfile,
} from '../api';
import { useGlobalToast } from '../hooks/useToast';
import { useTableSelection } from '../hooks/useTableSelection';
import { useTableSort } from '../hooks/useTableSort';
import { Icons } from '../components/ui/Icons';
import { Pagination } from '../components/ui/Pagination';
import { FilterBar } from '../components/students/FilterBar';
import { ExportButton } from '../components/students/ExportButton';
import type {
  ClassInfo,
  DeviceConfig,
  SchoolDeviceInfo,
  StudentDiagnosticsResponse,
  StudentDiagnosticsRow,
} from '../types';

type LiveStatus =
  | 'PRESENT'
  | 'ABSENT'
  | 'OFFLINE'
  | 'EXPIRED'
  | 'NO_CREDENTIALS'
  | 'ERROR'
  | 'PENDING'
  | 'UNSENT';

type LiveDeviceResult = {
  status: LiveStatus;
  message?: string | null;
  checkedAt?: string;
};

type StudentLiveState = {
  running: boolean;
  checkedAt?: string;
  byDeviceId: Record<string, LiveDeviceResult>;
};

// Helpers
function normalize(value?: string | null): string {
  return (value || '').trim().toLowerCase();
}

function statusBadgeClass(status: LiveStatus): string {
  if (status === 'PRESENT') return 'badge badge-success';
  if (status === 'PENDING' || status === 'UNSENT') return 'badge badge-warning';
  if (status === 'ABSENT') return 'badge';
  return 'badge badge-danger';
}

function statusLabel(status: LiveStatus): string {
  if (status === 'PRESENT') return 'Bor';
  if (status === 'ABSENT') return "Yo'q";
  if (status === 'OFFLINE') return 'Offline';
  if (status === 'EXPIRED') return 'Muddati tugagan';
  if (status === 'NO_CREDENTIALS') return "Credentials yo'q";
  if (status === 'ERROR') return 'Xato';
  if (status === 'PENDING') return 'Kutilmoqda';
  return 'Yuborilmagan';
}

function statusReason(status: LiveStatus, message?: string | null): string {
  if (message && message.trim()) return message;
  if (status === 'PRESENT') return "O'quvchi qurilmada topildi";
  if (status === 'ABSENT') return "O'quvchi qurilmada topilmadi";
  if (status === 'OFFLINE') return "Qurilmaga ulanish bo'lmadi";
  if (status === 'EXPIRED') return "Local credentials muddati tugagan";
  if (status === 'NO_CREDENTIALS') return "Bu kompyuterda qurilma credentials yo'q";
  if (status === 'PENDING') return 'Jarayon davom etmoqda';
  if (status === 'UNSENT') return "Provisioning hali yuborilmagan";
  return "Noma'lum xato";
}

function formatDateTime(value?: string): string {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toLocaleString('uz-UZ');
}

function mapBackendStatus(row: StudentDiagnosticsRow): Record<string, LiveDeviceResult> {
  const result: Record<string, LiveDeviceResult> = {};
  row.devices.forEach((device) => {
    if (device.status === 'SUCCESS') {
      result[device.deviceId] = {
        status: 'PRESENT',
        message: "Server log bo'yicha yozilgan",
        checkedAt: device.updatedAt || undefined,
      };
      return;
    }
    if (device.status === 'FAILED') {
      result[device.deviceId] = {
        status: 'ERROR',
        message: device.lastError || "Provisioning xatosi",
        checkedAt: device.updatedAt || undefined,
      };
      return;
    }
    if (device.status === 'PENDING') {
      result[device.deviceId] = {
        status: 'PENDING',
        message: 'Provisioning yakunlanmagan',
        checkedAt: device.updatedAt || undefined,
      };
      return;
    }
    result[device.deviceId] = {
      status: 'UNSENT',
      message: "Provisioning yozuvi yo'q",
      checkedAt: device.updatedAt || undefined,
    };
  });
  return result;
}

function summarizeStatuses(statuses: LiveDeviceResult[], running: boolean): { text: string; isOk: boolean } {
  if (running) return { text: 'Tekshirilmoqda...', isOk: true };
  if (statuses.length === 0) return { text: "Qurilma yo'q", isOk: false };
  const ok = statuses.filter((item) => item.status === 'PRESENT').length;
  const issues = statuses.filter((item) =>
    ['ABSENT', 'OFFLINE', 'EXPIRED', 'NO_CREDENTIALS', 'ERROR'].includes(item.status),
  ).length;
  if (issues === 0 && ok === statuses.length) return { text: `OK ${ok}/${statuses.length}`, isOk: true };
  if (issues === 0) return { text: `Jarayonda ${ok}/${statuses.length}`, isOk: true };
  return { text: `Muammo ${issues}`, isOk: false };
}

const PAGE_SIZE = 25;

export function StudentsPage() {
  const [availableClasses, setAvailableClasses] = useState<ClassInfo[]>([]);
  const [localDevices, setLocalDevices] = useState<DeviceConfig[]>([]);
  const [backendDevices, setBackendDevices] = useState<SchoolDeviceInfo[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [diagnostics, setDiagnostics] = useState<StudentDiagnosticsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [liveStateByStudent, setLiveStateByStudent] = useState<Record<string, StudentLiveState>>({});
  const [openPopoverStudentId, setOpenPopoverStudentId] = useState<string | null>(null);

  // Editing
  const [editingStudent, setEditingStudent] = useState<StudentDiagnosticsRow | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editFatherName, setEditFatherName] = useState('');
  const [editClassId, setEditClassId] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);

  const { addToast } = useGlobalToast();
  const schoolId = useMemo(() => getAuthUser()?.schoolId || '', []);

  // Prepare data
  const rows = diagnostics?.data || [];
  
  // Selection hook
  const {
    selectedKeys,
    selectedCount,
    isAllSelected,
    isSelected,
    toggleItem,
    toggleAll,
    clearSelection,
  } = useTableSelection({ items: rows, keyField: 'studentId' });

  // Sort hook
  const { sortedData, sortColumn, sortDirection, toggleSort } = useTableSort({
    data: rows,
  });

  // Filter by status
  const filteredData = useMemo(() => {
    if (!selectedStatus) return sortedData;
    return sortedData.filter((row) => {
      const liveState = liveStateByStudent[row.studentId];
      const effectiveByDevice = liveState?.byDeviceId || mapBackendStatus(row);
      const statusList = backendDevices.map(
        (device) => effectiveByDevice[device.id] || { status: 'UNSENT' as LiveStatus },
      );
      const summary = summarizeStatuses(statusList, Boolean(liveState?.running));
      if (selectedStatus === 'ok') return summary.isOk;
      return !summary.isOk;
    });
  }, [sortedData, selectedStatus, liveStateByStudent, backendDevices]);

  // Pagination
  const total = filteredData.length;
  const paginatedData = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredData.slice(start, start + PAGE_SIZE);
  }, [filteredData, page]);

  const localByBackendId = useMemo(() => {
    const map = new Map<string, DeviceConfig>();
    localDevices.forEach((device) => {
      if (device.backendId) map.set(device.backendId, device);
    });
    return map;
  }, [localDevices]);

  const localByExternalId = useMemo(() => {
    const map = new Map<string, DeviceConfig>();
    localDevices.forEach((device) => {
      if (device.deviceId) map.set(normalize(device.deviceId), device);
    });
    return map;
  }, [localDevices]);

  // Debounce search
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  // Load initial data
  useEffect(() => {
    if (!schoolId) return;
    const loadInitial = async () => {
      try {
        const [classes, devices, school] = await Promise.all([
          fetchClasses(schoolId),
          fetchDevices(),
          fetchSchoolDevices(schoolId),
        ]);
        setAvailableClasses(classes);
        setLocalDevices(devices);
        setBackendDevices(school);
      } catch (err) {
        console.error('Failed to load initial data:', err);
        addToast("Boshlang'ich ma'lumotlarni yuklashda xato", 'error');
      }
    };
    loadInitial();
  }, [schoolId, addToast]);

  const loadDiagnostics = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const data = await fetchStudentDiagnostics(schoolId, {
        classId: selectedClassId || undefined,
        search: debouncedSearchQuery || undefined,
      });
      setDiagnostics(data);
      clearSelection();
    } catch (err) {
      console.error('Failed to load diagnostics:', err);
      addToast('Diagnostikani yuklashda xato', 'error');
    } finally {
      setLoading(false);
    }
  }, [schoolId, selectedClassId, debouncedSearchQuery, addToast, clearSelection]);

  useEffect(() => {
    loadDiagnostics();
  }, [loadDiagnostics]);

  // Close popover on outside click
  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('.diagnostics-hover')) return;
      setOpenPopoverStudentId(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenPopoverStudentId(null);
    };

    document.addEventListener('mousedown', handleDocumentClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  // Edit handlers
  const startEdit = (student: StudentDiagnosticsRow) => {
    setEditingStudent(student);
    setEditFirstName(student.firstName || '');
    setEditLastName(student.lastName || '');
    setEditFatherName(student.fatherName || '');
    setEditClassId(student.classId || '');
  };

  const cancelEdit = () => {
    setEditingStudent(null);
    setEditFirstName('');
    setEditLastName('');
    setEditFatherName('');
    setEditClassId('');
  };

  const saveEdit = async () => {
    if (!editingStudent) return;
    if (!editFirstName.trim() || !editLastName.trim()) {
      addToast('Ism va familiya majburiy', 'error');
      return;
    }
    if (!editClassId) {
      addToast('Sinf majburiy', 'error');
      return;
    }

    setSavingEdit(true);
    try {
      await updateStudentProfile(editingStudent.studentId, {
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        fatherName: editFatherName.trim() || undefined,
        classId: editClassId,
      });
      addToast("O'quvchi yangilandi", 'success');
      cancelEdit();
      await loadDiagnostics();
    } catch (err) {
      console.error('Failed to update student:', err);
      addToast('Yangilashda xato', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const runLiveCheck = async (row: StudentDiagnosticsRow) => {
    if (!row.deviceStudentId) {
      addToast("O'quvchida Device ID yo'q", 'error');
      return;
    }

    setLiveStateByStudent((prev) => ({
      ...prev,
      [row.studentId]: {
        running: true,
        byDeviceId: prev[row.studentId]?.byDeviceId || {},
      },
    }));

    const checks = await Promise.all(
      backendDevices.map(async (backendDevice) => {
        const localDevice =
          localByBackendId.get(backendDevice.id) ||
          (backendDevice.deviceId
            ? localByExternalId.get(normalize(backendDevice.deviceId))
            : undefined);

        if (!localDevice) {
          return {
            backendDeviceId: backendDevice.id,
            status: 'NO_CREDENTIALS' as LiveStatus,
            message: "Bu kompyuterda credentials topilmadi",
            checkedAt: new Date().toISOString(),
          };
        }

        try {
          const result = await checkStudentOnDevice(localDevice.id, row.deviceStudentId || '');
          return {
            backendDeviceId: backendDevice.id,
            status: result.status as LiveStatus,
            message: result.message,
            checkedAt: result.checkedAt,
          };
        } catch (err) {
          return {
            backendDeviceId: backendDevice.id,
            status: 'ERROR' as LiveStatus,
            message: err instanceof Error ? err.message : 'Live check xatosi',
            checkedAt: new Date().toISOString(),
          };
        }
      }),
    );

    const byDeviceId: Record<string, LiveDeviceResult> = {};
    checks.forEach((item) => {
      byDeviceId[item.backendDeviceId] = {
        status: item.status,
        message: item.message,
        checkedAt: item.checkedAt,
      };
    });

    setLiveStateByStudent((prev) => ({
      ...prev,
      [row.studentId]: {
        running: false,
        checkedAt: new Date().toISOString(),
        byDeviceId,
      },
    }));
  };

  // Sort icon render
  const renderSortIcon = (column: keyof StudentDiagnosticsRow) => {
    if (sortColumn !== column) {
      return <Icons.ArrowUpDown />;
    }
    return sortDirection === 'asc' ? <Icons.ChevronUp /> : <Icons.ChevronDown />;
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">O'quvchilar</h1>
          <p className="page-description">Sinf bo'yicha ro'yxat va live diagnostika</p>
        </div>
        <div className="page-actions">
          <ExportButton
            students={filteredData}
            selectedIds={selectedKeys}
            devices={backendDevices}
          />
        </div>
      </div>

      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedClassId={selectedClassId}
        classes={availableClasses}
        onClassChange={(classId) => { setSelectedClassId(classId); setPage(1); }}
        selectedStatus={selectedStatus}
        onStatusChange={(status) => { setSelectedStatus(status); setPage(1); }}
      />

      {editingStudent && (
        <div className="card edit-user-panel">
          <h2>O'quvchini tahrirlash</h2>
          <div className="form-row">
            <div className="form-group">
              <label>Familiya</label>
              <input className="input" value={editLastName} onChange={(e) => setEditLastName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Ism</label>
              <input className="input" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Otasining ismi</label>
              <input className="input" value={editFatherName} onChange={(e) => setEditFatherName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Sinf</label>
              <select className="input" value={editClassId} onChange={(e) => setEditClassId(e.target.value)}>
                <option value="">Tanlang</option>
                {availableClasses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-actions">
            <button className="button button-primary" onClick={saveEdit} disabled={savingEdit}>
              <Icons.Check /> Saqlash
            </button>
            <button className="button button-secondary" onClick={cancelEdit} disabled={savingEdit}>
              <Icons.X /> Bekor qilish
            </button>
          </div>
        </div>
      )}

      <div className="page-content">
        {selectedCount > 0 && (
          <div className="selection-toolbar">
            <span className="selection-count">{selectedCount} ta tanlandi</span>
            <button className="button button-secondary button-compact" onClick={clearSelection}>
              Bekor qilish
            </button>
          </div>
        )}

        {loading ? (
          <div className="loading-state">Yuklanmoqda...</div>
        ) : paginatedData.length === 0 ? (
          <div className="empty-state">
            <Icons.Users />
            <p>O'quvchilar topilmadi</p>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="table diagnostics-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>
                      <input
                        type="checkbox"
                        className="table-checkbox"
                        checked={isAllSelected}
                        onChange={toggleAll}
                        aria-label="Barchasini tanlash"
                      />
                    </th>
                    <th style={{ width: 50 }}>#</th>
                    <th>
                      <button
                        type="button"
                        className={`table-header-sortable ${sortColumn === 'studentName' ? 'active' : ''}`}
                        onClick={() => toggleSort('studentName')}
                      >
                        O'quvchi
                        <span className="sort-icon">{renderSortIcon('studentName')}</span>
                      </button>
                    </th>
                    <th>
                      <button
                        type="button"
                        className={`table-header-sortable ${sortColumn === 'className' ? 'active' : ''}`}
                        onClick={() => toggleSort('className')}
                      >
                        Sinf
                        <span className="sort-icon">{renderSortIcon('className')}</span>
                      </button>
                    </th>
                    <th>Device ID</th>
                    <th>Diagnostika</th>
                    <th>Amal</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((row, index) => {
                    const liveState = liveStateByStudent[row.studentId];
                    const effectiveByDevice = liveState?.byDeviceId || mapBackendStatus(row);
                    const statusList = backendDevices.map(
                      (device) => effectiveByDevice[device.id] || { status: 'UNSENT' as LiveStatus },
                    );
                    const summary = summarizeStatuses(statusList, Boolean(liveState?.running));

                    return (
                      <tr
                        key={row.studentId}
                        className={isSelected(row.studentId) ? 'selected' : ''}
                      >
                        <td>
                          <input
                            type="checkbox"
                            className="table-checkbox"
                            checked={isSelected(row.studentId)}
                            onChange={() => toggleItem(row.studentId)}
                            aria-label={`${row.studentName} ni tanlash`}
                          />
                        </td>
                        <td>{(page - 1) * PAGE_SIZE + index + 1}</td>
                        <td>{row.studentName}</td>
                        <td>{row.className || '-'}</td>
                        <td>{row.deviceStudentId || '-'}</td>
                        <td>
                          <div className={`diagnostics-hover ${openPopoverStudentId === row.studentId ? 'is-open' : ''}`}>
                            <button
                              type="button"
                              className={`diagnostics-trigger badge ${summary.isOk ? 'badge-success' : 'badge-warning'}`}
                              onClick={() =>
                                setOpenPopoverStudentId((prev) => (prev === row.studentId ? null : row.studentId))
                              }
                              aria-expanded={openPopoverStudentId === row.studentId}
                              aria-label={`${row.studentName} diagnostika detallarini ochish`}
                            >
                              {summary.text}
                            </button>
                            <div className="diagnostics-popover">
                              <div className="diagnostics-popover-title">
                                Qurilmalar holati
                              </div>
                              <div className="diagnostics-popover-list">
                                {backendDevices.map((device) => {
                                  const result = effectiveByDevice[device.id] || { status: 'UNSENT' as LiveStatus };
                                  return (
                                    <div key={`${row.studentId}-${device.id}`} className="diagnostics-popover-item">
                                      <div className="diagnostics-popover-head">
                                        <span className="diagnostics-device-name">{device.name}</span>
                                        <span className={statusBadgeClass(result.status)}>
                                          {statusLabel(result.status)}
                                        </span>
                                      </div>
                                      <div className="diagnostics-popover-meta">
                                        <span>Sabab: {statusReason(result.status, result.message)}</span>
                                        <span>Vaqt: {formatDateTime(result.checkedAt)}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button
                              className="button button-secondary button-compact"
                              onClick={() => runLiveCheck(row)}
                              disabled={Boolean(liveState?.running)}
                            >
                              <Icons.Refresh /> {liveState?.running ? 'Tekshirilmoqda' : 'Tekshir'}
                            </button>
                            <button
                              className="btn-icon btn-primary"
                              onClick={() => startEdit(row)}
                              aria-label={`${row.studentName} ni tahrirlash`}
                              title="Tahrirlash"
                            >
                              <Icons.Edit />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              onChange={setPage}
            />
          </>
        )}
      </div>
    </div>
  );
}
