import { useCallback, useEffect, useMemo, useState } from "react";
import { getAuthUser, getSchoolProvisioningLogs, retryProvisioning } from "../api";
import type { ProvisioningAuditQuery, ProvisioningLogEntry } from "../api";
import { Icons } from "../components/ui/Icons";
import { useGlobalToast } from "../hooks/useToast";

const PAGE_SIZE = 50;

function formatStudentName(log: ProvisioningLogEntry): string {
  if (log.student?.lastName || log.student?.firstName) {
    return [log.student?.lastName, log.student?.firstName].filter(Boolean).join(" ");
  }
  return log.student?.name || "-";
}

function levelTone(level: string): "info" | "warn" | "error" {
  const value = String(level || "").toUpperCase();
  if (value === "WARN") return "warn";
  if (value === "ERROR") return "error";
  return "info";
}

function statusTone(status?: string | null): "success" | "warn" | "error" | "info" {
  const value = String(status || "").toUpperCase();
  if (value === "SUCCESS" || value === "CONFIRMED") return "success";
  if (value === "FAILED") return "error";
  if (value === "PROCESSING" || value === "PENDING" || value === "PARTIAL") return "warn";
  return "info";
}

type RetryTarget = {
  provisioningId: string;
  deviceIds: string[];
};

function getRetryTargetByLogType(log: ProvisioningLogEntry): RetryTarget | null {
  if (!log.provisioningId) return null;
  const stage = String(log.stage || "").toUpperCase();
  const status = String(log.status || "").toUpperCase();
  if (stage === "DEVICE_RESULT" && status === "FAILED") {
    return { provisioningId: log.provisioningId, deviceIds: log.deviceId ? [log.deviceId] : [] };
  }
  if (stage === "PROVISIONING_START" && (status === "FAILED" || status === "PARTIAL")) {
    return { provisioningId: log.provisioningId, deviceIds: [] };
  }
  return null;
}

function downloadCsv(rows: ProvisioningLogEntry[]) {
  const header = [
    "createdAt",
    "level",
    "eventType",
    "stage",
    "status",
    "actorId",
    "actorName",
    "actorRole",
    "student",
    "device",
    "message",
    "provisioningId",
  ];
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const body = rows.map((log) => {
    const student = formatStudentName(log);
    const device = log.device?.name || log.deviceId || "-";
    return [
      log.createdAt,
      log.level,
      log.eventType || "",
      log.stage || "",
      log.status || "",
      log.actorId || "",
      log.actorName || "",
      log.actorRole || "",
      student,
      device,
      log.message || "",
      log.provisioningId || "",
    ]
      .map(escape)
      .join(",");
  });
  const csv = [header.join(","), ...body].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function AuditLogsPage() {
  const { addToast } = useGlobalToast();
  const user = getAuthUser();
  const schoolId = user?.schoolId || "";
  const [logs, setLogs] = useState<ProvisioningLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPayload, setSelectedPayload] = useState<ProvisioningLogEntry | null>(null);

  const [draftQ, setDraftQ] = useState("");
  const [draftLevel, setDraftLevel] = useState<ProvisioningAuditQuery["level"]>("");
  const [draftEventType, setDraftEventType] = useState("");
  const [draftStage, setDraftStage] = useState("");
  const [draftStatus, setDraftStatus] = useState("");
  const [draftActorId, setDraftActorId] = useState("");
  const [filters, setFilters] = useState<ProvisioningAuditQuery>({});

  const totalPages = useMemo(() => (total === 0 ? 1 : Math.ceil(total / PAGE_SIZE)), [total]);

  const fetchLogs = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await getSchoolProvisioningLogs(schoolId, { ...filters, page, limit: PAGE_SIZE });
      setLogs(response.data);
      setTotal(response.total);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      addToast("Audit loglarni yuklashda xato", "error");
    } finally {
      setLoading(false);
    }
  }, [schoolId, filters, page, addToast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setFilters({
        q: draftQ.trim() || undefined,
        level: draftLevel || undefined,
        eventType: draftEventType.trim() || undefined,
        stage: draftStage.trim() || undefined,
        status: draftStatus.trim() || undefined,
        actorId: draftActorId.trim() || undefined,
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [draftQ, draftLevel, draftEventType, draftStage, draftStatus, draftActorId]);

  const resetFilters = () => {
    setDraftQ("");
    setDraftLevel("");
    setDraftEventType("");
    setDraftStage("");
    setDraftStatus("");
    setDraftActorId("");
    setPage(1);
    setFilters({});
  };

  const handleRetryFromLog = async (log: ProvisioningLogEntry) => {
    const target = getRetryTargetByLogType(log);
    if (!target) return;
    setRetryingId(log.id);
    try {
      const result = await retryProvisioning(target.provisioningId, target.deviceIds);
      const checked = result.connectionCheck?.checked ?? 0;
      const failed = result.connectionCheck?.failed ?? 0;
      const missing = result.connectionCheck?.missingCredentials ?? 0;
      addToast(
        `Qayta urinish yuborildi. Tekshirildi: ${checked}, ulanish xato: ${failed}, sozlama yo'q: ${missing}`,
        failed > 0 || missing > 0 ? "error" : "success",
      );
      await fetchLogs();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      addToast(`Qayta urinishda xato: ${message}`, "error");
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Loglar</h1>
          <p className="page-description">Auth, CRUD, provisioning va security audit tarixi</p>
        </div>
        <div className="page-actions">
          <button type="button" className="device-select-trigger" onClick={fetchLogs} disabled={loading}>
            <Icons.Refresh />
            <span>Yangilash</span>
          </button>
          <button type="button" className="button button-secondary" onClick={() => downloadCsv(logs)}>
            CSV export
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="form-group">
          <label>Qidirish</label>
          <input className="input" placeholder="Xabar, event, actor..." value={draftQ} onChange={(e) => setDraftQ(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Level</label>
          <select className="input" value={draftLevel} onChange={(e) => setDraftLevel(e.target.value as ProvisioningAuditQuery["level"])}>
            <option value="">Barchasi</option>
            <option value="INFO">INFO</option>
            <option value="WARN">WARN</option>
            <option value="ERROR">ERROR</option>
          </select>
        </div>
        <div className="form-group">
          <label>Event</label>
          <input className="input" placeholder="AUTH_LOGIN_SUCCESS..." value={draftEventType} onChange={(e) => setDraftEventType(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Stage</label>
          <input className="input" placeholder="PROVISIONING_START..." value={draftStage} onChange={(e) => setDraftStage(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Status</label>
          <input className="input" placeholder="SUCCESS/FAILED..." value={draftStatus} onChange={(e) => setDraftStatus(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Actor ID</label>
          <input className="input" placeholder="user id" value={draftActorId} onChange={(e) => setDraftActorId(e.target.value)} />
        </div>
        <div className="form-group" style={{ alignSelf: "flex-end", display: "flex", gap: "0.5rem" }}>
          <button type="button" className="btn-icon" onClick={resetFilters} title="Filtrlarni tozalash" aria-label="Filtrlarni tozalash">
            <Icons.X />
          </button>
        </div>
      </div>

      <div className="stats-bar">
        <div className="stat-item"><span className="stat-label">Jami log:</span><span className="stat-value">{total}</span></div>
        <div className="stat-item"><span className="stat-label">Sahifa:</span><span className="stat-value">{page}/{totalPages}</span></div>
      </div>

      <div className="page-content">
        {error && <div className="notice notice-error">{error}</div>}
        {loading ? (
          <div className="loading-state">Yuklanmoqda...</div>
        ) : logs.length === 0 ? (
          <div className="empty-state"><Icons.FileSpreadsheet /><p>Audit log topilmadi</p></div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Vaqt</th><th>Level</th><th>Event</th><th>Status</th><th>Actor</th><th>O'quvchi</th><th>Qurilma</th><th>Xabar</th><th>Payload</th><th>Amal</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const retryTarget = getRetryTargetByLogType(log);
                  return (
                    <tr key={log.id}>
                      <td>{new Date(log.createdAt).toLocaleString()}</td>
                      <td><span className={`log-chip log-chip-${levelTone(log.level)}`}>{log.level}</span></td>
                      <td>{log.eventType || log.stage}</td>
                      <td><span className={`log-chip log-chip-${statusTone(log.status)}`}>{log.status || "-"}</span></td>
                      <td>{log.actorName || log.actorId || "-"}</td>
                      <td>{formatStudentName(log)}</td>
                      <td>{log.device?.name || log.deviceId || "-"}</td>
                      <td>{log.message || "-"}</td>
                      <td>
                        <button type="button" className="button button-secondary" onClick={() => setSelectedPayload(log)}>
                          Ko'rish
                        </button>
                      </td>
                      <td>
                        {retryTarget ? (
                          <button
                            type="button"
                            className="button button-secondary"
                            onClick={() => handleRetryFromLog(log)}
                            disabled={loading || retryingId === log.id}
                          >
                            <Icons.Refresh />
                            {retryingId === log.id ? "Yuborilmoqda..." : "Qayta urinish"}
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="page-actions" style={{ marginTop: "1rem", justifyContent: "space-between" }}>
        <button type="button" className="button button-secondary" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          Oldingi
        </button>
        <button type="button" className="button button-secondary" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
          Keyingi
        </button>
      </div>

      {selectedPayload && (
        <div className="modal-overlay" onClick={() => setSelectedPayload(null)}>
          <div className="modal-content" style={{ maxWidth: "900px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Audit Payload</h2>
              <button type="button" className="btn-icon" onClick={() => setSelectedPayload(null)}><Icons.X /></button>
            </div>
            <pre style={{ maxHeight: "480px", overflow: "auto", margin: 0 }}>
              {JSON.stringify(selectedPayload.payload || {}, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
