import { useEffect, useState } from 'react';
import type { Lang } from '../i18n/translations';
import { t } from '../i18n/translations';
import './ValidationPanel.css';

type LicenseRow = { id: number; systemId: string; productName?: string };

export function ValidationPanel({
  userId,
  lang,
  userEmail,
  authHeaders
}: {
  userId: string;
  lang: Lang;
  userEmail: string | null;
  authHeaders: (json?: boolean) => Record<string, string>;
}) {
  const tr = t(lang);
  const [licenses, setLicenses] = useState<LicenseRow[]>([]);
  const [systemId, setSystemId] = useState('');
  const [numeroConta, setNumeroConta] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/me/licenses', { headers: authHeaders() })
      .then(r => r.json())
      .then((d: unknown) => {
        if (!Array.isArray(d)) return;
        const rows = d as LicenseRow[];
        setLicenses(rows);
        setSystemId('');
        const first = rows[0];
        if (first?.systemId) setSystemId(first.systemId);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ver userId
  }, [userId]);

  const systemOptions = [...new Map(licenses.map(l => [l.systemId, l.productName || l.systemId])).entries()];

  const submit = async () => {
    if (!systemId.trim() || !numeroConta.trim()) return;
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch('/api/me/validate-license', {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ system_id: systemId.trim(), numero_conta: numeroConta.trim() })
      });
      const data = (await res.json().catch(() => ({}))) as { status?: string; message?: string };
      if (res.ok && data.status === 'success') {
        setMessage({ type: 'ok', text: data.message || tr.validation_valid });
      } else {
        setMessage({ type: 'err', text: data.message || tr.validation_invalid });
      }
    } catch {
      setMessage({ type: 'err', text: tr.profile_connection_error });
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = systemOptions.length > 0 && systemId.trim().length > 0 && numeroConta.trim().length >= 3;

  return (
    <div className="validation-page">
      <header className="validation-header">
        <h1>{tr.validation_title}</h1>
        <p>{tr.validation_intro}</p>
      </header>

      {systemOptions.length === 0 ? (
        <section className="validation-card validation-card--notice">
          <p className="validation-no-products">{tr.validation_no_products}</p>
        </section>
      ) : (
        <section className="validation-card">
          <label className="validation-label">{tr.validation_email_label}</label>
          <input className="validation-input" readOnly value={userEmail || '—'} />

          <label className="validation-label">{tr.validation_system_label}</label>
          <select className="validation-input" value={systemId} onChange={e => setSystemId(e.target.value)}>
            <option value="">{tr.validation_system_placeholder}</option>
            {systemOptions.map(([sid, label]) => (
              <option key={sid} value={sid}>
                {label}
              </option>
            ))}
          </select>

          <label className="validation-label">{tr.validation_account_label}</label>
          <input
            className="validation-input"
            value={numeroConta}
            onChange={e => setNumeroConta(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
          />

          <button type="button" className="validation-submit" disabled={loading || !canSubmit} onClick={submit}>
            {loading ? tr.validation_loading : tr.validation_submit}
          </button>

          {message && (
            <p className={message.type === 'ok' ? 'validation-msg validation-msg--ok' : 'validation-msg validation-msg--err'}>{message.text}</p>
          )}
        </section>
      )}
    </div>
  );
}
