import { useEffect, useMemo, useState } from 'react';
import { Bell, Copy, Pencil, Plus, Trash2 } from 'lucide-react';
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

type Message = {
  id: string;
  slug: string;
  title: string;
  body: string;
  url: string;
  mediaUrl: string;
  popup: boolean;
  silent: boolean;
  kind: string;
  startsAt: string;
  expiresAt: string;
  enabled: boolean;
};

type FormState = {
  slug: string;
  title: string;
  body: string;
  url: string;
  mediaUrl: string;
  popup: boolean;
  silent: boolean;
  startsAt: string;
  expiresAt: string;
  enabled: boolean;
};

function emptyForm(): FormState {
  const window = defaultWindow();
  return {
    slug: '',
    title: '',
    body: '',
    url: '',
    mediaUrl: '',
    popup: true,
    silent: false,
    startsAt: window.startsAt,
    expiresAt: window.expiresAt,
    enabled: true,
  };
}

function fromRow(row: Message): FormState {
  return {
    slug: row.slug,
    title: row.title,
    body: row.body,
    url: row.url,
    mediaUrl: row.mediaUrl,
    popup: row.popup,
    silent: row.silent,
    startsAt: toLocalInput(row.startsAt),
    expiresAt: toLocalInput(row.expiresAt),
    enabled: row.enabled,
  };
}

export function OraculoBellAdmin({
  authHeaders,
  publicUrl,
}: {
  authHeaders: AuthHeaders;
  publicUrl: string;
}) {
  const [rows, setRows] = useState<Message[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const res = await fetch('/api/admin/oraculo/notifications', { headers: authHeaders() });
    if (!res.ok) throw new Error('Não foi possível carregar as mensagens.');
    setRows((await res.json()) as Message[]);
  };

  useEffect(() => {
    void load().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Falha ao carregar.'));
    // Carrega uma vez ao abrir a aba.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const previewMedia = useMemo(() => {
    const url = form.mediaUrl.trim();
    if (!url) return null;
    const lower = url.toLowerCase();
    if (/\.(mp4|webm)(\?|#|$)/.test(lower)) return { kind: 'video' as const, url };
    if (/\.(png|jpe?g|gif|webp)(\?|#|$)/.test(lower) || url.includes('/api/public/media/')) {
      return { kind: 'image' as const, url };
    }
    return null;
  }, [form.mediaUrl]);

  const save = async () => {
    setError('');
    setBusy(true);
    try {
      const payload = {
        slug: form.slug,
        title: form.title,
        body: form.body,
        url: form.url,
        mediaUrl: form.mediaUrl,
        popup: form.popup,
        silent: form.silent,
        startsAt: fromLocalInput(form.startsAt),
        expiresAt: fromLocalInput(form.expiresAt),
        enabled: form.enabled,
        kind: 'marketing',
      };
      const res = await fetch(
        editingId ? `/api/admin/oraculo/notifications/${editingId}` : '/api/admin/oraculo/notifications',
        {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify(payload),
        }
      );
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

  const remove = async (row: Message) => {
    if (!window.confirm(`Apagar “${row.title}”? Quem já viu no sininho não recebe de novo com o mesmo id.`)) return;
    const res = await fetch(`/api/admin/oraculo/notifications/${row.id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
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
          <h2>{editingId ? 'Editar mensagem' : 'Nova mensagem do sininho'}</h2>
          <p className="oraculo-admin-help">
            Vai para o sininho do Oráculo: título, texto, imagem ou vídeo, e um botão com link.
            Quem já recebeu o mesmo id não vê de novo.
          </p>
          <label>Título</label>
          <input
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            maxLength={150}
            required
          />
          <label>Texto</label>
          <textarea
            rows={5}
            value={form.body}
            onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
            maxLength={2000}
            required
          />
          <label>Link do botão (HTTPS, opcional)</label>
          <input
            type="url"
            placeholder="https://…"
            value={form.url}
            onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
          />
          <label>Imagem ou vídeo (HTTPS)</label>
          <input
            type="url"
            placeholder="https://…png ou /api/public/media/…/file"
            value={form.mediaUrl}
            onChange={(e) => setForm((p) => ({ ...p, mediaUrl: e.target.value }))}
          />
          <label className="oraculo-admin-file">
            Enviar arquivo
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                setUploading(true);
                void uploadPublicFile(file, authHeaders())
                  .then((url) => setForm((p) => ({ ...p, mediaUrl: url })))
                  .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Falha no upload.'))
                  .finally(() => setUploading(false));
              }}
            />
          </label>
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
          {editingId && (
            <>
              <label>Id estável (não mude se a pessoa já recebeu)</label>
              <input value={form.slug} onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))} />
            </>
          )}
          <label className="oraculo-admin-check">
            <input
              type="checkbox"
              checked={form.popup}
              onChange={(e) => setForm((p) => ({ ...p, popup: e.target.checked }))}
            />
            Abrir popup na tela
          </label>
          <label className="oraculo-admin-check">
            <input
              type="checkbox"
              checked={form.silent}
              onChange={(e) => setForm((p) => ({ ...p, silent: e.target.checked }))}
            />
            Sem som
          </label>
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
              {busy ? 'Salvando…' : editingId ? 'Salvar mensagem' : 'Publicar no sininho'}
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
          <h2>Como aparece no Oráculo</h2>
          <div className="oraculo-bell-preview">
            <div className="oraculo-bell-preview__chrome">
              <Bell size={16} aria-hidden />
              <span>Aviso</span>
            </div>
            <strong>{form.title || 'Título da mensagem'}</strong>
            {previewMedia?.kind === 'image' && (
              <img src={previewMedia.url} alt="" className="oraculo-bell-preview__media" />
            )}
            {previewMedia?.kind === 'video' && (
              <video src={previewMedia.url} className="oraculo-bell-preview__media" controls muted />
            )}
            <p>{form.body || 'O texto da mensagem aparece aqui, com o botão de link embaixo.'}</p>
            {form.url.trim() && <span className="oraculo-bell-preview__btn">Abrir conteúdo</span>}
          </div>
          <p className="oraculo-admin-help">
            Endereço que o Oráculo consulta:
            <br />
            <code>{publicUrl}</code>
            <button
              type="button"
              className="btn-secondary-sm"
              onClick={() => void copyText(publicUrl)}
            >
              <Copy size={14} aria-hidden /> Copiar
            </button>
          </p>
        </aside>
      </div>

      <div className="admin-table-container">
        <h3>
          <Plus size={16} aria-hidden /> Mensagens
        </h3>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Título</th>
                <th>Id</th>
                <th>Janela</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="admin-table-muted">
                    Nenhuma mensagem ainda. Publique a primeira ao lado.
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
                    <td>{row.title}</td>
                    <td>
                      <code>{row.slug}</code>
                    </td>
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
