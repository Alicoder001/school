import { Icons } from '../../components/ui/Icons';
import type { WebhookInfo } from '../../api';

type WebhookTabProps = {
  webhookInfo: WebhookInfo | null;
  webhookHealth: {
    lastWebhookEventAt: string | null;
    lastSeenAt: string | null;
  } | null;
  showSecrets: boolean;
  busyAction: string | null;
  onToggleSecrets: () => void;
  onCopy: (value: string, label: string) => Promise<void>;
  onTestWebhook: (direction: 'in' | 'out') => Promise<void>;
  onRotateSecret: (direction: 'in' | 'out') => Promise<void>;
};

function maskSecret(value: string): string {
  return value.replace(/secret=[^&]+/i, 'secret=***');
}

export function WebhookTab({
  webhookInfo,
  webhookHealth,
  showSecrets,
  busyAction,
  onToggleSecrets,
  onCopy,
  onTestWebhook,
  onRotateSecret,
}: WebhookTabProps) {
  if (!webhookInfo) {
    return <p className="notice notice-warning">Webhook ma'lumotlari yo'q</p>;
  }

  return (
    <div className="device-list">
      <div className="device-item">
        <div className="device-item-header">
          <strong>Webhook health</strong>
          <div className="device-item-meta">
            <span className="badge">
              Last event: {webhookHealth?.lastWebhookEventAt ? new Date(webhookHealth.lastWebhookEventAt).toLocaleString() : '-'}
            </span>
            <span className="badge">
              Last seen: {webhookHealth?.lastSeenAt ? new Date(webhookHealth.lastSeenAt).toLocaleString() : '-'}
            </span>
          </div>
        </div>
      </div>
      <div className="form-actions" style={{ marginBottom: 12 }}>
        <button
          type="button"
          className="button button-secondary"
          onClick={onToggleSecrets}
        >
          {showSecrets ? 'Secretlarni yashirish' : 'Secretlarni ko\'rsatish'}
        </button>
      </div>
      <div className="device-item">
        <div className="device-item-header">
          <strong>Kirish webhook</strong>
          <div className="device-item-meta">
            <span className="badge">
              {showSecrets ? webhookInfo.inUrlWithSecret : maskSecret(webhookInfo.inUrlWithSecret)}
            </span>
          </div>
        </div>
        <div className="device-item-actions">
          <button className="btn-icon" onClick={() => void onCopy(webhookInfo.inUrlWithSecret, 'Kirish webhook')}>
            <Icons.Copy />
          </button>
          <button className="btn-icon" onClick={() => void onTestWebhook('in')} disabled={busyAction === 'test-webhook-in'}>
            <Icons.Refresh />
          </button>
          <button className="btn-icon btn-danger" onClick={() => void onRotateSecret('in')} disabled={busyAction === 'rotate-in'}>
            <Icons.Edit />
          </button>
        </div>
      </div>
      <div className="device-item">
        <div className="device-item-header">
          <strong>Chiqish webhook</strong>
          <div className="device-item-meta">
            <span className="badge">
              {showSecrets ? webhookInfo.outUrlWithSecret : maskSecret(webhookInfo.outUrlWithSecret)}
            </span>
          </div>
        </div>
        <div className="device-item-actions">
          <button className="btn-icon" onClick={() => void onCopy(webhookInfo.outUrlWithSecret, 'Chiqish webhook')}>
            <Icons.Copy />
          </button>
          <button className="btn-icon" onClick={() => void onTestWebhook('out')} disabled={busyAction === 'test-webhook-out'}>
            <Icons.Refresh />
          </button>
          <button className="btn-icon btn-danger" onClick={() => void onRotateSecret('out')} disabled={busyAction === 'rotate-out'}>
            <Icons.Edit />
          </button>
        </div>
      </div>
    </div>
  );
}
