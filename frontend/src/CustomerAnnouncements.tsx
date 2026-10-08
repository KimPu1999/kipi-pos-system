import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { Bell, Check } from './icons';
type Announcement = {
  id: number;
  title: string;
  message: string;
  author_name: string;
  created_at: string;
  read_at: string | null;
};
export default function CustomerAnnouncements({
  onUnread,
}: {
  onUnread?: (count: number) => void;
}) {
  const [items, setItems] = useState<Announcement[]>([]),
    panel = useRef<HTMLDetailsElement>(null);
  const load = () =>
    api<Announcement[]>('/announcements')
      .then(setItems)
      .catch(() => {});
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(timer);
  }, []);
  const unread = items.filter((item) => !item.read_at).length;
  useEffect(() => onUnread?.(unread), [unread, onUnread]);
  async function read(item: Announcement) {
    if (!item.read_at) {
      await api(`/announcements/${item.id}/read`, { method: 'POST' });
      setItems((old) =>
        old.map((a) => (a.id === item.id ? { ...a, read_at: new Date().toISOString() } : a)),
      );
    }
  }
  async function readAll() {
    for (const item of items.filter((a) => !a.read_at))
      await api(`/announcements/${item.id}/read`, { method: 'POST' });
    setItems((old) => old.map((a) => ({ ...a, read_at: a.read_at || new Date().toISOString() })));
  }
  return (
    <details className="order-notifications" ref={panel}>
      <summary aria-label={`Store announcements, ${unread} unread`}>
        <Bell size={22} />
        {unread > 0 && <span className="notification-count">{unread > 99 ? '99+' : unread}</span>}
      </summary>
      <section className="notification-panel">
        <div className="notification-heading">
          <h2>Store announcements</h2>
          <button disabled={!unread} onClick={() => void readAll()}>
            <Check size={14} />
            Read all
          </button>
        </div>
        <p className="notification-info">Messages from Kipi POS administration.</p>
        <div className="notification-list">
          {items.map((item) => (
            <button
              className={item.read_at ? 'notification-item' : 'notification-item unread'}
              key={item.id}
              onClick={() => {
                void read(item);
                panel.current?.removeAttribute('open');
              }}
            >
              <span>
                <b>{item.title}</b>
                <small>{item.message}</small>
                <time dateTime={item.created_at}>
                  {item.author_name} · {new Date(item.created_at).toLocaleString()}
                </time>
              </span>
              {!item.read_at && <i aria-label="Unread" />}
            </button>
          ))}
        </div>
        {!items.length && <p className="notification-empty">No announcements from the admin.</p>}
      </section>
    </details>
  );
}
