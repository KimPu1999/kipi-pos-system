import { useEffect, useState, type FormEvent } from 'react';
import { api } from './api';
import { Bell, Trash2 } from './icons';
type Announcement = { id: number; title: string; message: string; created_at: string };
export default function AdminAnnouncements() {
  const [items, setItems] = useState<Announcement[]>([]),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [error, setError] = useState('');
  const load = () => api<Announcement[]>('/announcements').then(setItems);
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, []);
  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      d = new FormData(form);
    setBusy(true);
    setError('');
    try {
      await api('/announcements', {
        method: 'POST',
        body: JSON.stringify({ title: d.get('title'), message: d.get('message') }),
      });
      form.reset();
      setNotice('Announcement sent to every customer header.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to send announcement.');
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: number) {
    if (!confirm('Remove this customer announcement?')) return;
    setBusy(true);
    try {
      await api(`/announcements/${id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to remove announcement.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel admin-announcements">
      <div className="section-heading">
        <div>
          <span className="eyebrow">CUSTOMER HEADER</span>
          <h2>
            <Bell size={19} /> Customer announcements
          </h2>
          <p className="muted">
            Send a message to the notification bell on every customer account.
          </p>
        </div>
      </div>
      {notice && (
        <p className="success" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <form onSubmit={send}>
        <fieldset disabled={busy}>
          <label>
            Announcement title
            <input
              name="title"
              required
              maxLength={150}
              placeholder="Example: Store closing time"
            />
          </label>
          <label>
            Message
            <textarea
              name="message"
              required
              maxLength={2000}
              rows={4}
              placeholder="Write the message customers should see…"
            />
          </label>
          <button className="primary">{busy ? 'Sending…' : 'Send to customers'}</button>
        </fieldset>
      </form>
      <div className="announcement-admin-list">
        {items.map((item) => (
          <article key={item.id}>
            <div>
              <b>{item.title}</b>
              <p>{item.message}</p>
              <small>{new Date(item.created_at).toLocaleString()}</small>
            </div>
            <button className="cash-delete" disabled={busy} onClick={() => void remove(item.id)}>
              <Trash2 size={15} /> Remove
            </button>
          </article>
        ))}
      </div>
      {!items.length && <p className="empty">No customer announcements yet.</p>}
    </section>
  );
}
