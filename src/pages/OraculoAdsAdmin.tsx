import { useEffect, useState } from 'react';
import { Copy, Pencil, Trash2 } from 'lucide-react';
import {
  FEED_STATUS_LABEL,
  copyText,
  defaultWindow,
  feedStatus,
  fromLocalInput,
  toLocalInput,
  uploadPublicFile,
} from '../lib/oraculoAdmin';

type AuthHeaders = () => Record<string, string>;

type Ad = {
  id: string;
  slug: string;
  label: string;
  imageUrl: string;
  imageUrlDesktop: string;
  url: string;
  startsAt: string;
  expiresAt: string;
  enabled: boolean;
  sortOrder: number;
};

type FormState = {
  slug: string;
  label: string;
  imageUrl: string;
  imageUrlDesktop: string;
  url: string;
  startsAt: string;
  expiresAt: string;
  enabled: boolean;
  sortOrder: string;
};

const MONITOR_FILE = '340 × 400 px';
const DESKTOP_FILE = '340 × 760 px';

function emptyForm(): FormState {
  const window = defaultWindow();
  return {
    slug: '',
    label: '',
    imageUrl: '',
    imageUrlDesktop: '',
    url: '',
    startsAt: window.startsAt,
    expiresAt: window.expiresAt,
    enabled: true,
    sortOrder: '0',
  };
}

function fromRow(row: Ad): FormState {
  return {
    slug: row.slug,
    label: row.label,
    imageUrl: row.imageUrl,
    imageUrlDesktop: row.imageUrlDesktop || '',
    url: row.url,
    startsAt: toLocalInput(row.startsAt),
    expiresAt: toLocalInput(row.expiresAt),
    enabled: row.enabled,
    sortOrder: String(row.sortOrder ?? 0),
  };
}

export function OraculoAdsAdmin({
  authHeaders,
  publicUrl,
}: {
  authHeaders: AuthHeaders;
  publicUrl: string;
}) {
  const [rows, setRows] = useState<Ad[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<'' | 'monitor' | 'desktop'>('');
  const [error, setError] = useState('');

  const load = async () => {
    const res = await fetch('/api/admin/oraculo/ads', { headers: authHeaders() });
    if (!res.ok) throw new Error('Não foi possível carregar as peças.');
    setRows((await res.json()) as Ad[]);
  };

  useEffect(() => {
    void load().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Falha ao carregar.'));
    // Carrega uma vez ao abrir a aba.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setError('');
    setBusy(true);
    try {
      const payload = {
        slug: form.slug,
        label: form.label,
        imageUrl: form.imageUrl,
        imageUrlDesktop: form.imageUrlDesktop,
        url: form.url,
        startsAt: fromLocalInput(form.startsAt),
        expiresAt: fromLocalInput(form.expiresAt),
        enabled: form.enabled,
        sortOrder: Number(form.sortOrder) || 0,
      };
      const res = await fetch(editingId ? `/api/admin/oraculo/ads/${editingId}` : '/api/admin/oraculo/ads', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Não foi possível salvar.');
      setEditingId(null);
      setForm(emptyForm());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: Ad) => {
    if (!window.confirm(`Apagar a peça “${row.label || row.slug}”?`)) return;
    const res = await fetch(`/api/admin/oraculo/ads/${row.id}`, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok) {
      setError('Não foi possível apagar.');
      return;
    }
    if (editingId === row.id) {
      setEditingId(null);
      setForm(emptyForm());
    }
    await load();
  };

  return (
    <div className="admin-content admin-content--stack">
      <div className="oraculo-admin-grid">
        <form
          className="admin-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <h2>{editingId ? 'Editar peça' : 'Nova peça da barra'}</h2>
          <p className="oraculo-admin-help">
            Fica no vão debaixo de Suporte no Oráculo. Só imagem e link. Sem vídeo — vídeo vai no sininho.
            Uma peça fica fixa; várias trocam sozinhas a cada 15 segundos.
          </p>
          <label>Nome interno (só no admin)</label>
          <input
            value={form.label}
            onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
            placeholder="Ex.: Corretora abril"
          />
          <label>Imagem dos monitores — {MONITOR_FILE}</label>
          <p className="oraculo-admin-help">
            Crie o arquivo em <strong>{MONITOR_FILE}</strong>. Na barra de 186 px ela aparece em <strong>170 × 200</strong>.
            O notebook usa esta mesma imagem.
          </p>
          <input
            type="url"
            required
            placeholder="https://…png"
            value={form.imageUrl}
            onChange={(e) => setForm((p) => ({ ...p, imageUrl: e.target.value }))}
          />
          <label className="oraculo-admin-file">
            Enviar imagem dos monitores ({MONITOR_FILE})
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              disabled={uploading !== ''}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                setUploading('monitor');
                void uploadPublicFile(file, authHeaders())
                  .then((url) => setForm((p) => ({ ...p, imageUrl: url })))
                  .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Falha no upload.'))
                  .finally(() => setUploading(''));
              }}
            />
          </label>
          <label>Imagem do desktop — {DESKTOP_FILE}</label>
          <p className="oraculo-admin-help">
            Crie o arquivo em <strong>{DESKTOP_FILE}</strong>. Na barra de 186 px ela aparece em <strong>170 × 380</strong>.
          </p>
          <input
            type="url"
            required
            placeholder="https://…png"
            value={form.imageUrlDesktop}
            onChange={(e) => setForm((p) => ({ ...p, imageUrlDesktop: e.target.value }))}
          />
          <label className="oraculo-admin-file">
            Enviar imagem do desktop ({DESKTOP_FILE})
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              disabled={uploading !== ''}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                setUploading('desktop');
                void uploadPublicFile(file, authHeaders())
                  .then((url) => setForm((p) => ({ ...p, imageUrlDesktop: url })))
                  .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Falha no upload.'))
                  .finally(() => setUploading(''));
              }}
            />
          </label>
          <label>Link do clique (HTTPS)</label>
          <input
            type="url"
            required
            placeholder="https://…"
            value={form.url}
            onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
          />
          <div className="oraculo-admin-dates">
            <label>
              Começa
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm((p) => ({ ...p, startsAt: e.target.value }))}
                required
              />
            </label>
            <label>
              Termina
              <input
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) => setForm((p) => ({ ...p, expiresAt: e.target.value }))}
                required
              />
            </label>
          </div>
          <label>Ordem (menor aparece primeiro)</label>
          <input
            type="number"
            value={form.sortOrder}
            onChange={(e) => setForm((p) => ({ ...p, sortOrder: e.target.value }))}
          />
          <label className="oraculo-admin-check">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))}
            />
            Publicada
          </label>
          {error && <p className="oraculo-admin-error">{error}</p>}
          <div className="oraculo-admin-actions">
            <button type="submit" className="btn-primary" disabled={busy || uploading !== ''}>
              {busy ? 'Salvando…' : editingId ? 'Salvar peça' : 'Publicar na barra'}
            </button>
            {editingId && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm());
                }}
              >
                Nova
              </button>
            )}
          </div>
        </form>

        <aside className="oraculo-preview-wrap">
          <h2>Tamanho de cada imagem</h2>
          <div className="oraculo-ad-previews">
            <div>
              <h3>Monitores — {MONITOR_FILE}</h3>
              <div className="oraculo-ad-rail">
                <div className="oraculo-ad-rail__nav">Suporte</div>
                <a className="oraculo-ad-card oraculo-ad-card--monitor" href={form.url || '#'} target="_blank" rel="noreferrer">
                  {form.imageUrl ? (
                    <img src={form.imageUrl} alt={form.label || 'Monitores'} />
                  ) : (
                    <span>340 × 400 px. Aparece em 170 × 200.</span>
                  )}
                </a>
              </div>
            </div>
            <div>
              <h3>Desktop — {DESKTOP_FILE}</h3>
              <div className="oraculo-ad-rail">
                <div className="oraculo-ad-rail__nav">Suporte</div>
                <a className="oraculo-ad-card oraculo-ad-card--desktop" href={form.url || '#'} target="_blank" rel="noreferrer">
                  {form.imageUrlDesktop ? (
                    <img src={form.imageUrlDesktop} alt={form.label || 'Desktop'} />
                  ) : (
                    <span>340 × 760 px. Aparece em 170 × 380.</span>
                  )}
                </a>
              </div>
            </div>
          </div>
          <p className="oraculo-admin-help">
            As duas barras grandes têm 186 px de largura. A dos monitores é mais baixa; a do desktop é mais alta. Por isso são dois arquivos. O notebook usa a imagem dos monitores, na barra de 210 px.
            <br />
            <code>{publicUrl}</code>
            <button type="button" className="btn-secondary-sm" onClick={() => void copyText(publicUrl)}>
              <Copy size={14} aria-hidden /> Copiar
            </button>
          </p>
        </aside>
      </div>

      <div className="admin-table-container">
        <h3>Peças no ar</h3>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Peça</th>
                <th>Ordem</th>
                <th>Janela</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="admin-table-muted">
                    Nenhuma peça ainda. Publique a primeira ao lado.
                  </td>
                </tr>
              )}
              {rows.map((row) => {
                const status = feedStatus(row.startsAt, row.expiresAt, row.enabled);
                return (
                  <tr key={row.id}>
                    <td>
                      <span className={`oraculo-status oraculo-status--${status}`}>
                        {FEED_STATUS_LABEL[status]}
                      </span>
                    </td>
                    <td>
                      <div className="oraculo-ad-row">
                        {row.imageUrl && <img src={row.imageUrl} alt="" />}
                        <div>
                          <strong>{row.label || row.slug}</strong>
                          <div className="admin-table-muted">{row.url}</div>
                        </div>
                      </div>
                    </td>
                    <td>{row.sortOrder}</td>
                    <td className="admin-table-muted">
                      {new Date(row.startsAt).toLocaleString('pt-BR')} → {new Date(row.expiresAt).toLocaleString('pt-BR')}
                    </td>
                    <td>
                      <button type="button" className="btn-icon" onClick={() => { setEditingId(row.id); setForm(fromRow(row)); }}>
                        <Pencil size={16} />
                      </button>
                      <button type="button" className="btn-icon btn-danger" onClick={() => void remove(row)}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
