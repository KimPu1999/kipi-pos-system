import BrandLogo from './BrandLogo';
import {
  ArrowUpRight,
  Banknote,
  ShoppingBag,
  Users,
  Package,
  Receipt,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  TrendingUp,
  Activity,
} from './icons';
type Product = { id: number; name: string; stock: number; emoji: string; active: boolean | number };
type Order = {
  id: number;
  status: string;
  total_cents: number;
  customer_name: string;
  created_at: string;
  items: { quantity: number }[];
};
type Data = {
  revenue_cents: number;
  sales_count: number;
  pending_orders: number;
  customers: number;
  low_stock: Product[];
};
const money = (c: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'MMK',
    currencyDisplay: 'code',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(c / 100);
export default function Dashboard({
  data,
  orders,
  products,
  name,
  navigate,
}: {
  data: Data;
  orders: Order[];
  products: Product[];
  name: string;
  navigate: (tab: string) => void;
}) {
  const open = orders.filter((o) => ['pending', 'confirmed', 'ready'].includes(o.status));
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - i));
    return {
      date,
      label: date.toLocaleDateString('en-US', { weekday: 'short' }),
      count: orders.filter((o) => new Date(o.created_at).toDateString() === date.toDateString())
        .length,
    };
  });
  const maxCount = Math.max(1, ...days.map((d) => d.count));
  const statuses = [
    { key: 'pending', label: 'Waiting for confirmation', color: '#d6a047' },
    { key: 'confirmed', label: 'Being prepared', color: '#6289c7' },
    { key: 'ready', label: 'Ready for pickup', color: '#62a486' },
    { key: 'completed', label: 'Completed', color: '#527061' },
    { key: 'cancelled', label: 'Cancelled', color: '#b58c88' },
  ].map((s) => ({ ...s, count: orders.filter((o) => o.status === s.key).length }));
  const active = products.filter((p) => p.active).length;
  const healthy = Math.max(0, active - data.low_stock.length);
  const metrics = [
    {
      label: 'Total paid revenue',
      value: money(data.revenue_cents),
      note: 'All recorded payments',
      icon: Banknote,
      color: 'green',
    },
    {
      label: 'Completed sales',
      value: data.sales_count,
      note: 'POS and collected orders',
      icon: Receipt,
      color: 'blue',
    },
    {
      label: 'Orders in progress',
      value: data.pending_orders,
      note: 'Waiting, preparing or ready',
      icon: ShoppingBag,
      color: 'amber',
    },
    {
      label: 'Registered customers',
      value: data.customers,
      note: 'Your customer community',
      icon: Users,
      color: 'purple',
    },
  ];
  return (
    <div className="dashboard-view">
      <section className="dashboard-welcome">
        <div>
          <span className="eyebrow">LET’S MAKE TODAY A GOOD ONE</span>
          <h2>Welcome back, {name.split(' ')[0]}.</h2>
          <p>Your sales, orders and inventory — together in one workspace.</p>
          <button type="button" className="welcome-action" onClick={() => navigate('pos')}>
            <Plus size={17} /> Start a new sale <ArrowUpRight size={17} />
          </button>
        </div>
        <div className="welcome-store">
          <BrandLogo showPos={false} />
          <span>KIPI POS</span>
          <b>Ready for business</b>
          <small>
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </small>
        </div>
      </section>
      <div className="dashboard-section-title">
        <h2>Business at a glance</h2>
        <span>All-time totals</span>
      </div>
      <div className="metric-grid">
        {metrics.map((m) => (
          <section className={`metric metric-${m.color}`} key={m.label}>
            <div className="metric-top">
              <span>{m.label}</span>
              <span className="metric-icon">
                <m.icon size={20} />
              </span>
            </div>
            <h2>{m.value}</h2>
            <p>{m.note}</p>
          </section>
        ))}
      </div>
      <div className="overview-analytics">
        <section className="panel order-activity-panel">
          <div className="dashboard-panel-title">
            <div>
              <span className="analytics-eyebrow">
                <TrendingUp size={14} /> ORDER ACTIVITY
              </span>
              <h2>Pickup orders this week</h2>
              <p>Orders placed each day, including cancelled orders.</p>
            </div>
            <span className="analytics-total">
              {days.reduce((n, d) => n + d.count, 0)}
              <small>last 7 days</small>
            </span>
          </div>
          <div
            className="order-bars"
            role="img"
            aria-label={days
              .map((d) => `${d.date.toLocaleDateString()}: ${d.count} orders`)
              .join('; ')}
          >
            {days.map((d, i) => (
              <div className={`order-bar-column ${i === 6 ? 'is-today' : ''}`} key={d.label}>
                <span className="bar-count">{d.count}</span>
                <div className="order-bar-track">
                  <div
                    className="order-bar-fill"
                    style={{ height: `${(d.count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="bar-day">{i === 6 ? 'Today' : d.label}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="panel order-status-panel">
          <div className="dashboard-panel-title">
            <div>
              <span className="analytics-eyebrow">
                <Activity size={14} /> STORE PULSE
              </span>
              <h2>Order breakdown</h2>
              <p>All pickup orders by current status.</p>
            </div>
          </div>
          <div className="status-distribution" aria-hidden="true">
            {statuses
              .filter((s) => s.count > 0)
              .map((s) => (
                <span key={s.key} style={{ background: s.color, flex: s.count }} />
              ))}
            {!orders.length && <span style={{ background: '#e8ecf2', flex: 1 }} />}
          </div>
          <div className="status-breakdown">
            {statuses.map((s) => (
              <div key={s.key}>
                <span className="breakdown-dot" style={{ background: s.color }} />
                <span>{s.label}</span>
                <b>{s.count}</b>
              </div>
            ))}
          </div>
          <button type="button" className="inventory-link" onClick={() => navigate('orders')}>
            Manage customer orders <ArrowUpRight size={16} />
          </button>
        </section>
      </div>
      <div className="dashboard-section-title">
        <h2>What needs your attention</h2>
        <span>Orders & inventory</span>
      </div>
      <div className="dashboard-grid">
        <section className="panel dashboard-orders">
          <div className="dashboard-panel-title">
            <div>
              <h2>Orders to take care of</h2>
              <p>A clear path from order to pickup.</p>
            </div>
            <button type="button" className="text-action" onClick={() => navigate('orders')}>
              View all <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="order-pipeline">
            {[
              { status: 'pending', label: 'Waiting', icon: Clock },
              { status: 'confirmed', label: 'Preparing', icon: Package },
              { status: 'ready', label: 'Ready', icon: CheckCircle2 },
            ].map((s) => (
              <div key={s.status}>
                <s.icon size={17} />
                <span>{s.label}</span>
                <b>{orders.filter((o) => o.status === s.status).length}</b>
              </div>
            ))}
          </div>
          {open.slice(0, 5).map((o) => (
            <button
              type="button"
              className="dashboard-order-row"
              aria-label={`View order ${o.id} for ${o.customer_name}`}
              key={o.id}
              onClick={() => navigate('orders')}
            >
              <span className={`order-row-icon order-row-icon-${o.status}`}>
                {o.status === 'ready' ? (
                  <CheckCircle2 size={22} />
                ) : o.status === 'confirmed' ? (
                  <Package size={22} />
                ) : (
                  <Clock size={22} />
                )}
              </span>
              <span className="order-row-person">
                <b>Order #{String(o.id).padStart(4, '0')}</b>
                <small>
                  {o.customer_name} · {o.items.reduce((n, i) => n + i.quantity, 0)} items
                </small>
              </span>
              <span className={`status ${o.status}`}>{o.status}</span>
              <b className="order-row-amount">{money(o.total_cents)}</b>
              <span className="order-row-action">
                View
                <ArrowUpRight size={16} />
              </span>
            </button>
          ))}
          {!open.length && (
            <div className="dashboard-empty">
              <CheckCircle2 size={29} />
              <h3>You’re all caught up</h3>
              <p>New pickup orders will appear here.</p>
            </div>
          )}
        </section>
        <section className="panel dashboard-stock">
          <div className="dashboard-panel-title">
            <div>
              <h2>Inventory watch</h2>
              <p>Keep your favorites on the shelf.</p>
            </div>
            <span className="stock-alert-icon">
              <AlertTriangle size={19} />
            </span>
          </div>
          <div className="inventory-health">
            <div>
              <span>Healthy stock levels</span>
              <b>
                {healthy} / {active} products
              </b>
            </div>
            <progress
              max={Math.max(1, active)}
              value={healthy}
              aria-label="Active products with at least 5 units available"
            />
          </div>
          <div className="stock-summary">
            <span>{products.filter((p) => p.active).length} active products</span>
            <b>{data.low_stock.length} need attention</b>
          </div>
          {data.low_stock.slice(0, 5).map((p) => (
            <button className="stock-watch-row" key={p.id} onClick={() => navigate('products')}>
              <span className="stock-emoji">{p.emoji}</span>
              <span>
                <b>{p.name}</b>
                <small>{p.stock === 0 ? 'Out of stock' : 'Running low'}</small>
              </span>
              <span className={p.stock === 0 ? 'out-stock' : 'low'}>{p.stock} left</span>
            </button>
          ))}
          {!data.low_stock.length && (
            <div className="dashboard-empty">
              <Package size={29} />
              <h3>Stock is looking healthy</h3>
              <p>No active products below 5 units.</p>
            </div>
          )}
          <button type="button" className="inventory-link" onClick={() => navigate('products')}>
            Manage inventory <ArrowUpRight size={16} />
          </button>
        </section>
      </div>
      <div className="dashboard-section-title">
        <h2>Your next move</h2>
        <span>Everyday shortcuts</span>
      </div>
      <div className="dashboard-shortcuts">
        {[
          {
            tab: 'pos',
            title: 'Open the register',
            text: 'Build an order and record payment.',
            icon: ShoppingBag,
          },
          {
            tab: 'products',
            title: 'Manage your products',
            text: 'Update prices and available stock.',
            icon: Package,
          },
          {
            tab: 'customers',
            title: 'Meet your customers',
            text: 'Find the people behind your orders.',
            icon: Users,
          },
        ].map((a) => (
          <button
            type="button"
            className="dashboard-shortcut-action"
            key={a.tab}
            onClick={() => navigate(a.tab)}
          >
            <span className="shortcut-icon">
              <a.icon size={22} />
            </span>
            <span>
              <b>{a.title}</b>
              <small>{a.text}</small>
            </span>
            <ArrowUpRight size={18} />
          </button>
        ))}
      </div>
    </div>
  );
}
