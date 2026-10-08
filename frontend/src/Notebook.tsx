import { useEffect, useState, type FormEvent } from 'react';
import { api } from './api';
import { Search, Trash2 } from './icons';
import AdminAnnouncements from './AdminAnnouncements';
type Note = {
  id: number;
  title: string;
  category: string;
  content: string;
  pinned: boolean | number;
  file_name: string | null;
  file_size: number | null;
  updated_at: string;
};
export default function Notebook() {
  const [notes, setNotes] = useState<Note[]>([]),
    [editing, setEditing] = useState<Note | null>(null),
    [query, setQuery] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const load = () => api<Note[]>('/notes').then(setNotes);
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, []);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      d = new FormData(form);
    d.set('pinned', d.get('pinned') === 'on' ? '1' : '0');
    const file = d.get('excel_file');
    if (file instanceof File && !file.size) d.delete('excel_file');
    setBusy(true);
    setError('');
    try {
      await api(editing ? `/notes/${editing.id}` : '/notes', { method: 'POST', body: d });
      setEditing(null);
      form.reset();
      setNotice(editing ? 'Note updated.' : 'Note saved.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save note.');
    } finally {
      setBusy(false);
    }
  }
  async function remove(note: Note) {
    if (!confirm(`Delete “${note.title}”?`)) return;
    setBusy(true);
    try {
      await api(`/notes/${note.id}`, { method: 'DELETE' });
      if (editing?.id === note.id) setEditing(null);
      setNotice('Note deleted.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to delete note.');
    } finally {
      setBusy(false);
    }
  }
  const visible = notes.filter((n) =>
    `${n.title} ${n.category} ${n.content}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section className="notebook-workspace">
      <AdminAnnouncements />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="success" role="status">
          {notice}
        </p>
      )}
      <form className="panel notebook-form" key={editing?.id ?? 'new'} onSubmit={save}>
        <div className="section-heading">
          <div>
            <span className="eyebrow">ADMIN NOTEBOOK</span>
            <h2>{editing ? 'Edit note' : 'Create a general note'}</h2>
          </div>
        </div>
        <fieldset disabled={busy}>
          <div className="notebook-fields">
            <label>
              Title
              <input name="title" required maxLength={150} defaultValue={editing?.title} />
            </label>
            <label>
              Category
              <input
                name="category"
                required
                maxLength={60}
                list="note-categories"
                defaultValue={editing?.category ?? 'General'}
              />
              <datalist id="note-categories">
                <option value="General" />
                <option value="Stock" />
                <option value="Orders" />
                <option value="Staff" />
                <option value="Suppliers" />
                <option value="Reminder" />
              </datalist>
            </label>
            <label className="notebook-content">
              Note
              <textarea
                name="content"
                required
                maxLength={10000}
                rows={6}
                defaultValue={editing?.content}
              />
            </label>
            <label className="notebook-file">
              Attachment{' '}
              <input
                name="excel_file"
                type="file"
                accept=".xlsx,.xls,.csv,.png,.jpg,.jpeg,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,image/png,image/jpeg"
              />
              <small>
                {editing?.file_name
                  ? `Current: ${editing.file_name} · Choose a file to replace it.`
                  : 'XLSX, XLS, CSV, PNG or JPEG · Maximum 10 MB'}
              </small>
            </label>
            <label className="employee-check">
              <input name="pinned" type="checkbox" defaultChecked={!!editing?.pinned} /> Pin this
              note
            </label>
          </div>
          <div className="cash-form-actions">
            <button className="primary">
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Save note'}
            </button>
            {editing && (
              <button type="button" className="secondary" onClick={() => setEditing(null)}>
                Cancel editing
              </button>
            )}
          </div>
        </fieldset>
      </form>
      <section className="panel notebook-list">
        <div className="section-heading">
          <div>
            <h2>Saved notes</h2>
            <p className="muted">{notes.length} notes · pinned notes appear first.</p>
          </div>
        </div>
        <label className="search">
          <Search size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes…"
          />
        </label>
        <div className="notebook-grid">
          {visible.map((note) => (
            <article className={`notebook-card${note.pinned ? ' is-pinned' : ''}`} key={note.id}>
              <div>
                <span>{note.category}</span>
                {!!note.pinned && <b>PINNED</b>}
              </div>
              <h3>{note.title}</h3>
              <p>{note.content}</p>
              {note.file_name && (
                <a className="notebook-file-link" href={`/api/notes/${note.id}/file`} download>
                  Download attachment · {note.file_name}
                </a>
              )}
              <small>Updated {new Date(note.updated_at).toLocaleString()}</small>
              <footer>
                <button
                  className="cash-edit"
                  disabled={busy}
                  onClick={() => {
                    setEditing(note);
                    document
                      .querySelector('.notebook-form')
                      ?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  Edit
                </button>
                <button className="cash-delete" disabled={busy} onClick={() => void remove(note)}>
                  <Trash2 size={15} /> Delete
                </button>
              </footer>
            </article>
          ))}
        </div>
        {!visible.length && (
          <p className="empty">
            {notes.length ? 'No notes match your search.' : 'Create your first note above.'}
          </p>
        )}
      </section>
    </section>
  );
}
