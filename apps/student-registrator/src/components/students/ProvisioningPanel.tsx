import { useCallback, useEffect, useMemo, useState } from 'react';
import { getProvisioning, getProvisioningLogs, retryProvisioning } from '../../api';
import { Icons } from '../ui/Icons';
import type { ProvisioningDetails, ProvisioningLogEntry, RegisterResult } from '../../types';
import { useGlobalToast } from '../../hooks/useToast';

interface ProvisioningPanelProps {
  provisioningId?: string | null;
  registerResult?: RegisterResult | null;
}

export function ProvisioningPanel({
  provisioningId,
  registerResult,
}: ProvisioningPanelProps) {
  const { addToast } = useGlobalToast();
  const [details, setDetails] = useState<ProvisioningDetails | null>(null);
  const [logs, setLogs] = useState<ProvisioningLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetails = useCallback(async () => {
    if (!provisioningId) return;
    setLoading(true);
    setError(null);
    try {
      const [data, logData] = await Promise.all([
        getProvisioning(provisioningId),
        getProvisioningLogs(provisioningId),
      ]);
      setDetails(data);
      setLogs(logData);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [provisioningId]);

  useEffect(() => {
    if (!provisioningId) {
      setDetails(null);
      setLogs([]);
      setError(null);
      return;
    }
    fetchDetails();
  }, [provisioningId, fetchDetails]);

  const summary = useMemo(() => {
    if (!details?.devices) return null;
    const total = details.devices.length;
    const success = details.devices.filter((d) => d.status === 'SUCCESS').length;
    const failed = details.devices.filter((d) => d.status === 'FAILED').length;
    const pending = details.devices.filter((d) => d.status === 'PENDING').length;
    return { total, success, failed, pending };
  }, [details]);

  const failedDevices = useMemo(() => {
    if (!details?.devices) return [];
    return details.devices.filter((d) => d.status === 'FAILED');
  }, [details]);

  const retryFailed = useCallback(async () => {
    if (!provisioningId || !details?.devices) return;
    const failed = details.devices
      .filter((d) => d.status === 'FAILED')
      .map((d) => d.deviceId);
    if (failed.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const result = await retryProvisioning(provisioningId, failed);
      const checked = result.connectionCheck?.checked ?? 0;
      const failedChecks = result.connectionCheck?.failed ?? 0;
      const missing = result.connectionCheck?.missingCredentials ?? 0;
      addToast(
        `Retry yuborildi. Tekshirildi: ${checked}, ulanish xato: ${failedChecks}, sozlama yo'q: ${missing}`,
        failedChecks > 0 || missing > 0 ? 'error' : 'success',
      );
      await fetchDetails();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [details, fetchDetails, provisioningId]);

  if (!provisioningId && !registerResult) return null;

  return (
    <div className="card provisioning-panel">
      <div className="panel-header">
        <div>
          <div className="panel-title">Provisioning holati</div>
          {provisioningId ? (
            <div className="panel-subtitle">ID: {provisioningId}</div>
          ) : (
            <div className="panel-subtitle">Provisioning ID yo'q</div>
          )}
        </div>
        {provisioningId && (
          <div className="panel-actions">
            <button
              type="button"
              className="btn-icon"
              onClick={fetchDetails}
              disabled={loading}
              title="Yangilash"
              aria-label="Yangilash"
            >
              <Icons.Refresh />
            </button>
            <button
              type="button"
              className="btn-icon"
              onClick={retryFailed}
              disabled={loading || !summary?.failed}
              title="Failed qayta"
              aria-label="Failed qayta"
            >
              <Icons.Refresh />
            </button>
          </div>
        )}
      </div>

      {registerResult && (
        <div className="provisioning-results">
          {registerResult.results.map((result) => (
            <div key={result.deviceId}>
              {result.deviceName}: {result.connection.ok ? 'OK' : 'Offline'}
              {result.userCreate && !result.userCreate.ok
                ? ` - User xato (${result.userCreate.statusString || 'error'})`
                : ''}
              {result.faceUpload && !result.faceUpload.ok
                ? ` - Face xato (${result.faceUpload.statusString || 'error'})`
                : ''}
            </div>
          ))}
        </div>
      )}

      {error && <div className="notice notice-error">{error}</div>}

      {provisioningId && (
        <div className="provisioning-status">
          <span className="badge">
            {details?.status || (loading ? 'Yuklanmoqda' : "Noma'lum")}
          </span>
          {summary && (
            <div className="provisioning-summary">
              Jami: {summary.total} | Muvaffaqiyatli: {summary.success} | Xato:{' '}
              {summary.failed} | Kutilmoqda: {summary.pending}
            </div>
          )}
        </div>
      )}

      {failedDevices.length > 0 && (
        <div className="failed-list">
          {failedDevices.map((link) => (
            <div key={link.id} className="failed-item">
              <strong>{link.device?.name || link.deviceId}</strong>
              <span>{link.lastError || "Noma'lum xato"}</span>
            </div>
          ))}
        </div>
      )}

      {details?.devices && details.devices.length > 0 && (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Qurilma</th>
                <th>Status</th>
                <th>Xato</th>
              </tr>
            </thead>
            <tbody>
              {details.devices.map((link) => (
                <tr key={link.id}>
                  <td>{link.device?.name || link.deviceId}</td>
                  <td>{link.status}</td>
                  <td>{link.lastError || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {logs.length > 0 && (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Vaqt</th>
                <th>Bosqich</th>
                <th>Daraja</th>
                <th>Status</th>
                <th>Xabar</th>
              </tr>
            </thead>
            <tbody>
              {logs.slice(0, 50).map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.createdAt).toLocaleString()}</td>
                  <td>{log.stage}</td>
                  <td>{log.level}</td>
                  <td>{log.status || '-'}</td>
                  <td>{log.message || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length > 50 && (
            <div className="notice notice-warning">
              Loglar ko'p: oxirgi 50 ta ko'rsatildi.
            </div>
          )}
        </div>
      )}

      {provisioningId && !loading && !error && logs.length === 0 && (
        <div className="notice notice-warning">
          Hozircha loglar yo'q. Qayta yangilang yoki provisioning amalini qayta ishga tushiring.
        </div>
      )}
    </div>
  );
}
