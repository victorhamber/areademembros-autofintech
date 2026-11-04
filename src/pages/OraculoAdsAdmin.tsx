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
  url: string;
  startsAt: string;
  expiresAt: string;
  enabled: boolean;
  sortOrder: string;
};

function emptyForm(): FormState {
  const window = defaultWindow();
  return {
    slug: '',
    label: '',
    imageUrl: '',
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
  const [uploading, setUploading] = useState(false);
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
          <label>Imagem (HTTPS, png/jpg/gif/webp)</label>
          <input
            type="url"
            required
            placeholder="https://…png"
            value={form.imageUrl}
            onChange={(e) => setForm((p) => ({ ...p, imageUrl: e.target.value }))}
          />
          <label className="oraculo-admin-file">
            Enviar imagem
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                setUploading(true);
                void uploadPublicFile(file, authHeaders())
                  .then((url) => setForm((p) => ({ ...p, imageUrl: url })))
                  .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Falha no upload.'))
                  .finally(() => setUploading(false));
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
            <button type="submit" className="btn-primary" disabled={busy || uploading}>
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
          <h2>Vão da barra (186 px)</h2>
          <div className="oraculo-ad-rail">
            <div className="oraculo-ad-rail__nav">Suporte</div>
            <a
              className="oraculo-ad-card"
              href={form.url || '#'}
              target="_blank"
              rel="noreferrer"
            >
              {form.imageUrl ? (
                <img src={form.imageUrl} alt={form.label || 'Peça'} />
              ) : (
                <span>A imagem entra neste vão. Sem peça, ele fica vazio.</span>
              )}
            </a>
          </div>
          <p className="oraculo-admin-help">
            No desktop e no monitor comum a barra fica em <strong>186 px</strong>, a largura de antes. No notebook, <strong>210 px</strong>. A imagem entra inteira, no topo, sem corte. Uma arte vertical serve para as duas telas grandes.
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
