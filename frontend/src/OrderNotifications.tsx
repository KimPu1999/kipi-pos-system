import { useEffect, useRef, useState } from 'react';
import { Bell, Check, ShoppingBag } from './icons';
type Order = {
  id: number;
  status: string;
  delivery_status: string | null;
  customer_confirmed_at: string | null;
  updated_at: string;
  total_cents: number;
  sale_id?: number | null;
};
type Notice = {
  key: string;
  orderId: number;
  title: string;
  text: string;
  time: string;
  read: boolean;
  tone?: string;
};
export default function OrderNotifications({
  orders,
  userId,
  admin,
  onOrder,
  onUnread,
  loaded,
}: {
  orders: Order[];
  userId: number;
  admin: boolean;
  onOrder: (id: number) => void;
  onUnread?: (count: number) => void;
  loaded: boolean;
}) {
  const storageKey = `counter-notifications-${userId}`;
  const [notices, setNotices] = useState<Notice[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      return Array.isArray(saved)
        ? saved
            .filter(
              (n) =>
                typeof n.key === 'string' &&
                typeof n.orderId === 'number' &&
                typeof n.title === 'string' &&
                typeof n.text === 'string' &&
                typeof n.time === 'string' &&
                typeof n.read === 'boolean',
            )
            .slice(0, 50)
        : [];
    } catch {
      return [];
    }
  });
  const known = useRef(new Map<number, string>()),
    initialized = useRef(false),
    panel = useRef<HTMLDetailsElement>(null);
  const [sound, setSound] = useState(false),
    [soundError, setSoundError] = useState('');
  const audio = useRef<AudioContext | null>(null);
  function play() {
    const context = audio.current;
    if (!context || context.state !== 'running') return;
    [660, 880, 1046].forEach((frequency, index) => {
      const oscillator = context.createOscillator(),
        gain = context.createGain();
      const start = context.currentTime + index * 0.16;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.15, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.22);
    });
  }
  async function toggleSound() {
    if (sound) {
      setSound(false);
      return;
    }
    try {
      audio.current ??= new AudioContext();
      await audio.current.resume();
      setSound(true);
      setSoundError('');
      play();
    } catch {
      setSoundError('Sound is unavailable in this browser.');
    }
  }
  useEffect(
    () => () => {
      void audio.current?.close();
    },
    [],
  );
  useEffect(() => {
    if (!loaded) return;
    const changes: Notice[] = [];
    const eligible = (o: Order) =>
      !(admin && o.status === 'completed') &&
      ['pending', 'confirmed', 'ready', 'completed', 'cancelled'].includes(o.status);
    const noticeKey = (o: Order) =>
      `order-update:${o.id}:${o.status}:${o.delivery_status ?? 'no-delivery'}:${!!o.customer_confirmed_at}:${o.sale_id ?? 'unpaid'}`;
    const message = (o: Order) => {
      if (o.status === 'completed')
        return {
          title: 'Payment completed',
          text: admin
            ? 'Order completed and payment recorded.'
            : 'Your order is complete and payment has been recorded.',
          tone: 'completed',
        };
      if (o.status === 'cancelled')
        return {
          title: 'Order cancelled',
          text: 'This order was cancelled. No payment is due.',
          tone: 'cancelled',
        };
      if (o.delivery_status === 'delivered')
        return {
          title: 'Order delivered',
          text: admin
            ? 'Delivery confirmed. Take payment and print the receipt.'
            : 'Your order has arrived. The store will record payment and provide your receipt.',
          tone: 'completed',
        };
      if (o.delivery_status === 'out_for_delivery')
        return {
          title: 'Delivery is coming',
          text: admin
            ? 'The driver is on the way to the customer.'
            : 'Your Kipi POS order is on the way. Open the order to see the driver and estimated arrival.',
          tone: 'ready',
        };
      if (o.delivery_status === 'assigned')
        return {
          title: 'Driver assigned',
          text: admin
            ? 'Delivery details are ready. Start delivery when the driver leaves.'
            : 'A driver has been assigned to your order. Delivery details are available now.',
          tone: 'confirmed',
        };
      if (o.status === 'ready')
        return {
          title: 'Order ready',
          text: admin
            ? 'Order is ready. Payment is pending until completion.'
            : 'Your order is ready. Payment will be recorded when completed.',
          tone: 'ready',
        };
      if (o.status === 'confirmed')
        return {
          title: 'Order confirmed',
          text: admin
            ? 'Order accepted and preparing. Payment is pending.'
            : 'The store confirmed your order. Payment is pending until completion.',
          tone: 'confirmed',
        };
      if (admin && o.customer_confirmed_at)
        return {
          title: 'Customer confirmed order',
          text: 'Customer confirmation received. Review and accept this order. Payment is pending.',
          tone: 'customer-confirmed',
        };
      if (admin)
        return {
          title: 'New customer order',
          text: 'A new order was received. Waiting for customer confirmation before acceptance.',
          tone: 'pending',
        };
      return o.customer_confirmed_at
        ? {
            title: 'Confirmation sent',
            text: 'Waiting for the store to accept your confirmed order.',
            tone: 'customer-confirmed',
          }
        : {
            title: 'Order placed',
            text: 'Confirm your order to notify the store. Payment has not been recorded.',
            tone: 'pending',
          };
    };
    for (const o of orders) {
      const fingerprint = JSON.stringify([
        o.status,
        o.delivery_status,
        o.customer_confirmed_at,
        o.sale_id,
      ]);
      const previous = known.current.get(o.id);
      known.current.set(o.id, fingerprint);
      if (!eligible(o) || previous === fingerprint) continue;
      changes.push({
        key: noticeKey(o),
        orderId: o.id,
        ...message(o),
        time: o.updated_at,
        read: false,
      });
    }
    const activeKeys = new Set(orders.filter(eligible).map(noticeKey));
    setNotices((current) => current.filter((n) => activeKeys.has(n.key)));
    if (initialized.current && changes.length && sound) play();
    initialized.current = true;
    if (changes.length)
      setNotices((current) => {
        const keys = new Set(current.map((n) => n.key));
        return [...changes.filter((n) => !keys.has(n.key)), ...current]
          .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
          .slice(0, 50);
      });
  }, [orders, admin, sound, loaded]);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(notices));
    } catch {
      /* Notifications still work if browser storage is unavailable. */
    }
  }, [notices, storageKey]);
  const unread = notices.filter((n) => !n.read).length;
  useEffect(() => onUnread?.(unread), [unread, onUnread]);
  return (
    <details className="order-notifications" ref={panel}>
      <summary aria-label={`Order notifications, ${unread} unread`}>
        <Bell size={22} />
        {unread > 0 && <span className="notification-count">{unread > 99 ? '99+' : unread}</span>}
      </summary>
      <section className="notification-panel" aria-label="Order notifications">
        <div className="notification-heading">
          <h2>Order notifications</h2>
          <button
            disabled={!unread}
            onClick={() => setNotices((n) => n.map((item) => ({ ...item, read: true })))}
          >
            <Check size={14} />
            Read all
          </button>
        </div>
        <button
          className="notification-sound"
          aria-pressed={sound}
          onClick={() => void toggleSound()}
        >
          {sound ? 'Sound on · Mute' : 'Enable notification sound'}
        </button>
        {soundError && <p role="alert">{soundError}</p>}
        <p className="notification-info">Updates every 10 seconds while this page is visible.</p>
        <div className="notification-list">
          {notices.map((n) => (
            <button
              className={`${n.read ? 'notification-item' : 'notification-item unread'} notification-${n.tone || 'pending'}`}
              key={n.key}
              onClick={() => {
                setNotices((items) =>
                  items.map((item) => (item.key === n.key ? { ...item, read: true } : item)),
                );
                panel.current?.removeAttribute('open');
                onOrder(n.orderId);
              }}
            >
              <span className="notification-icon">
                <ShoppingBag size={18} />
              </span>
              <span>
                <b>
                  {n.title} · #{n.orderId}
                </b>
                <small>{n.text}</small>
                <time dateTime={n.time}>{new Date(n.time).toLocaleString()}</time>
              </span>
              {!n.read && <i aria-label="Unread" />}
            </button>
          ))}
        </div>
        {!notices.length && <p className="notification-empty">No order notifications yet.</p>}
      </section>
    </details>
  );
}
