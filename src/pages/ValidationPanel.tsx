import { useEffect, useMemo, useState } from 'react';
import type { Lang } from '../i18n/translations';
import { t } from '../i18n/translations';
import './ValidationPanel.css';

type LicenseRow = {
  id: number;
  systemId: string;
  productName?: string;
  numeroConta?: string;
  plano?: string;
  statusLicenca?: string;
  dataExpiracao?: string | null;
};

function isLicenseActive(l: LicenseRow): boolean {
  if (l.statusLicenca !== 'ativa') return false;
  if (!l.dataExpiracao) return true;
  return new Date(l.dataExpiracao).getTime() >= Date.now();
}

function licenseGroupKey(l: LicenseRow): string {
  return `${l.productName || ''}|${l.plano || ''}|${l.systemId || ''}`.toLowerCase();
}

function formatDateShort(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return '';
  const locale = lang === 'es' ? 'es-ES' : 'pt-BR';
  return new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function buildLicenseSlotMap(licenses: LicenseRow[]): Map<number, { index: number; total: number }> {
  const groups = new Map<string, LicenseRow[]>();
  for (const l of licenses) {
    const key = licenseGroupKey(l);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(l);
  }
  const slots = new Map<number, { index: number; total: number }>();
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => a.id - b.id);
    sorted.forEach((l, index) => slots.set(l.id, { index, total: sorted.length }));
  }
  return slots;
}

function formatLicenseDetail(
  l: LicenseRow,
  tr: ReturnType<typeof t>,
  lang: Lang,
  slot?: { index: number; total: number }
): string {
  const account = String(l.numeroConta || '').trim();
  if (account) return `${tr.validation_account_mt5}: ${account}`;

  const expiry = formatDateShort(l.dataExpiracao, lang);
  if (expiry) return `${tr.validation_valid_until} ${expiry}`;

  if (slot && slot.total > 1) {
    return tr.validation_access_slot
      .replace('{n}', String(slot.index + 1))
      .replace('{total}', String(slot.total));
  }

  return tr.validation_pending_account;
}

function formatLicenseLabel(
  l: LicenseRow,
  tr: ReturnType<typeof t>,
  lang: Lang,
  slot?: { index: number; total: number }
): string {
  const product = l.productName || l.systemId || 'Produto';
  const plan = l.plano ? ` · ${l.plano}` : '';
  return `${product}${plan} — ${formatLicenseDetail(l, tr, lang, slot)}`;
}

export function ValidationPanel({
  userId,
  lang,
  userEmail,
  authHeaders,
}: {
  userId: string;
  lang: Lang;
  userEmail: string | null;
  authHeaders: (json?: boolean) => Record<string, string>;
}) {
  const tr = t(lang);
  const [licenses, setLicenses] = useState<LicenseRow[]>([]);
  const [selectedLicenseId, setSelectedLicenseId] = useState('');
  const [numeroConta, setNumeroConta] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const selectableLicenses = useMemo(() => licenses.filter(isLicenseActive), [licenses]);

  const licenseSlots = useMemo(() => buildLicenseSlotMap(licenses), [licenses]);
  const activeLicenseSlots = useMemo(() => buildLicenseSlotMap(selectableLicenses), [selectableLicenses]);

  const selectedLicense = useMemo(
    () => selectableLicenses.find((l) => String(l.id) === selectedLicenseId) || null,
    [selectableLicenses, selectedLicenseId]
  );

  useEffect(() => {
    fetch('/api/me/licenses', { headers: authHeaders() })
      .then((r) => r.json())
      .then((d: unknown) => {
        if (!Array.isArray(d)) return;
        const rows = d as LicenseRow[];
        setLicenses(rows);
        const active = rows.filter(isLicenseActive);
        const first = active[0];
        if (first) {
          setSelectedLicenseId(String(first.id));
          setNumeroConta(String(first.numeroConta || '').trim());
        } else {
          setSelectedLicenseId('');
          setNumeroConta('');
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ver userId
  }, [userId]);

  const onSelectLicense = (id: string) => {
    setSelectedLicenseId(id);
    const lic = selectableLicenses.find((l) => String(l.id) === id);
    setNumeroConta(String(lic?.numeroConta || '').trim());
    setMessage(null);
  };

  const submit = async () => {
    if (!selectedLicense?.systemId || !numeroConta.trim()) return;
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch('/api/me/validate-license', {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({
          license_id: selectedLicense.id,
          system_id: selectedLicense.systemId.trim(),
          numero_conta: numeroConta.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { status?: string; message?: string };
      if (res.ok && data.status === 'success') {
        setMessage({ type: 'ok', text: data.message || tr.validation_valid });
        const listRes = await fetch('/api/me/licenses', { headers: authHeaders() });
        const list = (await listRes.json().catch(() => [])) as LicenseRow[];
        if (Array.isArray(list)) {
          setLicenses(list);
          const updated = list.find((l) => l.id === selectedLicense.id);
          if (updated?.numeroConta) setNumeroConta(String(updated.numeroConta).trim());
        }
      } else {
        setMessage({ type: 'err', text: data.message || tr.validation_invalid });
      }
    } catch {
      setMessage({ type: 'err', text: tr.profile_connection_error });
    } finally {
      setLoading(false);
    }
  };

  const canSubmit =
    selectableLicenses.length > 0 && selectedLicenseId.length > 0 && numeroConta.trim().length >= 3;

  return (
    <div className="validation-page">
      <header className="validation-header">
        <h1>{tr.validation_title}</h1>
        <p>{tr.validation_intro}</p>
      </header>

      {licenses.length === 0 ? (
        <section className="validation-card validation-card--notice">
          <p className="validation-no-products">{tr.validation_no_products}</p>
        </section>
      ) : (
        <>
          <section className="validation-card validation-card--list">
            <h2 className="validation-subtitle">{tr.validation_licenses_heading}</h2>
            <ul className="validation-license-list">
              {licenses.map((l) => {
                const active = isLicenseActive(l);
                const slot = licenseSlots.get(l.id);
                const detail = formatLicenseDetail(l, tr, lang, slot);
                return (
                  <li key={l.id} className="validation-license-item">
                    <div className="validation-license-item-main">
                      <span className="validation-license-product">
                        {l.productName || l.systemId}
                        {l.plano ? <span className="validation-license-plan"> · {l.plano}</span> : null}
                      </span>
                      <span
                        className={
                          active
                            ? 'validation-license-status validation-license-status--active'
                            : 'validation-license-status validation-license-status--inactive'
                        }
                      >
                        {active ? tr.validation_status_active : tr.validation_status_expired}
                      </span>
                    </div>
                    <p className="validation-license-detail">{detail}</p>
                  </li>
                );
              })}
            </ul>
          </section>

          {selectableLicenses.length === 0 ? (
            <section className="validation-card validation-card--notice">
              <p className="validation-no-products">{tr.validation_no_active_license}</p>
            </section>
          ) : (
            <section className="validation-card">
              <label className="validation-label">{tr.validation_email_label}</label>
              <input className="validation-input" readOnly value={userEmail || '—'} />

              <label className="validation-label">{tr.validation_system_label}</label>
              <select
                className="validation-input"
                value={selectedLicenseId}
                onChange={(e) => onSelectLicense(e.target.value)}
              >
                <option value="">{tr.validation_system_placeholder}</option>
                {selectableLicenses.map((l) => (
                  <option key={l.id} value={String(l.id)}>
                    {formatLicenseLabel(l, tr, lang, activeLicenseSlots.get(l.id))}
                  </option>
                ))}
              </select>

              <label className="validation-label">{tr.validation_account_label}</label>
              <input
                className="validation-input"
                value={numeroConta}
                onChange={(e) => setNumeroConta(e.target.value)}
                placeholder={tr.validation_account_placeholder}
                inputMode="numeric"
                autoComplete="off"
              />
              {selectedLicense && String(selectedLicense.numeroConta || '').trim() ? (
                <p className="validation-hint">{tr.validation_account_linked}</p>
              ) : (
                <p className="validation-hint">{tr.validation_account_new_hint}</p>
              )}

              <button
                type="button"
                className="validation-submit"
                disabled={loading || !canSubmit}
                onClick={submit}
              >
                {loading ? tr.validation_loading : tr.validation_submit}
              </button>

              {message && (
                <p
                  className={
                    message.type === 'ok'
                      ? 'validation-msg validation-msg--ok'
                      : 'validation-msg validation-msg--err'
                  }
                >
                  {message.text}
                </p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
