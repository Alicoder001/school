import { useCallback, useEffect, useMemo, useState } from 'react';
import { getProvisioning, retryProvisioning } from '../../api';
import { Icons } from '../ui/Icons';
import type { ProvisioningDetails, RegisterResult } from '../../types';

interface ProvisioningPanelProps {
  provisioningId?: string | null;
  registerResult?: RegisterResult | null;
}

export function ProvisioningPanel({
  provisioningId,
  registerResult,
}: ProvisioningPanelProps) {
  const [details, setDetails] = useState<ProvisioningDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetails = useCallback(async () => {
    if (!provisioningId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getProvisioning(provisioningId);
      setDetails(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [provisioningId]);

  useEffect(() => {
    if (!provisioningId) {
      setDetails(null);
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
      await retryProvisioning(provisioningId, failed);
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
              className="button button-secondary button-compact"
              onClick={fetchDetails}
              disabled={loading}
            >
              <Icons.Refresh /> Yangilash
            </button>
            <button
              type="button"
              className="button button-secondary button-compact"
              onClick={retryFailed}
              disabled={loading || !summary?.failed}
            >
              <Icons.Refresh /> Failed qayta
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
                  <td>{link.lastError || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
