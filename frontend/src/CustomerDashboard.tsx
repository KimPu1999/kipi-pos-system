import {
  ArrowRight,
  ArrowUpRight,
  ShoppingBag,
  Clock,
  CheckCircle2,
  Package,
  Banknote,
  Coffee,
  UserRound,
} from './icons';
import PromotionBanners from './PromotionBanners';
import type { Promotion } from './Promotions';
type Product = {
  id: number;
  name: string;
  category: string;
  price_cents: number;
  stock: number;
  emoji: string;
  image_path: string | null;
};
type Order = {
  id: number;
  status: string;
  total_cents: number;
  created_at: string;
  items: { name: string; quantity: number }[];
};
const money = (c: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'MMK',
    currencyDisplay: 'code',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(c / 100);
export default function CustomerDashboard({
  cart,
  onAdd,
  busy,
  promotions,
  onPromotion,
  name,
  products,
  orders,
  navigate,
}: {
  cart: Record<number, number>;
  onAdd: (id: number) => void;
  busy: boolean;
  promotions: Promotion[];
  onPromotion: (code: string) => void;
  name: string;
  products: Product[];
  orders: Order[];
  navigate: (tab: string, status?: string) => void;
}) {
  const open = orders.filter((o) => ['pending', 'confirmed', 'ready'].includes(o.status));
  const ready = orders.filter((o) => o.status === 'ready');
  const current = ready[0] || open[0];
  const completed = orders.filter((o) => o.status === 'completed');
  const favorite = products.filter((p) => p.stock > 0).slice(0, 4);
  return (
    <div className="customer-dashboard">
      <section className="customer-welcome">
        <div className="customer-welcome-copy">
          <span className="customer-kicker">YOUR EVERYDAY FAVORITES, ONE TAP AWAY</span>
          <h2>
            A good day starts here,
            <br />
            <span>{name.split(' ')[0]}.</span>
          </h2>
          <p>
            Fresh coffee, something sweet, and a little less waiting.
            <br />
            Order ahead and collect when it’s ready.
          </p>
          <button className="customer-hero-button" onClick={() => navigate('shop')}>
            Explore the menu <ArrowRight size={17} />
          </button>
          <div className="customer-hero-details">
            <span>
              <Clock size={14} /> Track your pickup
            </span>
            <span>
              <Banknote size={14} /> Pay in store
            </span>
          </div>
        </div>
        <div className="customer-welcome-art" aria-hidden="true">
          <div className="customer-art-circle" />
          <span className="customer-art-coffee">☕</span>
          <span className="customer-art-croissant">🥐</span>
          <span className="customer-art-caption">A little treat. A better day.</span>
        </div>
      </section>
      <PromotionBanners products={products} items={promotions} onSelect={onPromotion} />
      <div className="customer-stats">
        {[
          {
            title: 'Your orders',
            value: orders.length,
            note: 'Every pickup, in one place',
            icon: ShoppingBag,
            status: 'All',
            tone: 'orange',
          },
          {
            title: 'In progress',
            value: open.length,
            note: 'Waiting, preparing or ready',
            icon: Clock,
            status: 'All',
            tone: 'blue',
          },
          {
            title: 'Ready to collect',
            value: ready.length,
            note: ready.length ? 'Your favorites are waiting' : 'We’ll show ready orders here',
            icon: Package,
            status: 'ready',
            tone: 'green',
          },
          {
            title: 'Completed',
            value: completed.length,
            note: 'Collected and paid in store',
            icon: CheckCircle2,
            status: 'completed',
            tone: 'violet',
          },
        ].map((s) => (
          <button
            className={`customer-stat stat-${s.tone}`}
            key={s.title}
            onClick={() => navigate('orders', s.status)}
          >
            <div>
              <span>{s.title}</span>
              <s.icon size={19} />
            </div>
            <b>{s.value}</b>
            <small>{s.note}</small>
          </button>
        ))}
      </div>
      <div className="customer-home-grid">
        <section className="customer-home-panel">
          <div className="customer-panel-heading">
            <div>
              <span className="customer-kicker">STAY IN THE LOOP</span>
              <h2>Your next pickup</h2>
            </div>
            <button className="customer-text-link" onClick={() => navigate('orders')}>
              All orders <ArrowUpRight size={15} />
            </button>
          </div>
          {current ? (
            <>
              <div className="customer-pickup-title">
                <span className="customer-pickup-icon">
                  <ShoppingBag size={24} />
                </span>
                <div>
                  <b>Order #{String(current.id).padStart(4, '0')}</b>
                  <small>{new Date(current.created_at).toLocaleString()}</small>
                </div>
                <span className={`status ${current.status}`}>{current.status}</span>
              </div>
              <div className="customer-pickup-steps">
                {[
                  { key: 'pending', label: 'Placed' },
                  { key: 'confirmed', label: 'Preparing' },
                  { key: 'ready', label: 'Ready' },
                ].map((s, i) => (
                  <div
                    className={
                      ['pending', 'confirmed', 'ready'].indexOf(current.status) >= i
                        ? 'reached'
                        : ''
                    }
                    key={s.key}
                  >
                    <span>
                      {['pending', 'confirmed', 'ready'].indexOf(current.status) >= i ? (
                        <CheckCircle2 size={17} />
                      ) : (
                        i + 1
                      )}
                    </span>
                    <b>{s.label}</b>
                  </div>
                ))}
              </div>
              <p className="customer-pickup-message">
                {current.status === 'ready'
                  ? 'Your order is ready! Collect in store and pay at pickup.'
                  : current.status === 'confirmed'
                    ? 'Your order is being prepared. Check here for its pickup status.'
                    : 'Your order is waiting for the store to accept it. You can edit or cancel it in My orders.'}
              </p>
              <div className="customer-pickup-total">
                <span>
                  {current.items.reduce((sum, i) => sum + i.quantity, 0)} items · Cash at pickup
                </span>
                <b>{money(current.total_cents)}</b>
              </div>
              <button
                className="customer-outline-button"
                onClick={() => navigate('orders', current.status)}
              >
                View order details <ArrowRight size={16} />
              </button>
            </>
          ) : (
            <div className="customer-no-pickup">
              <ShoppingBag size={34} />
              <h3>Your next favorite is waiting</h3>
              <p>
                You have no active pickup orders.
                <br />
                Find something good on the menu.
              </p>
              <button className="customer-outline-button" onClick={() => navigate('shop')}>
                Start an order <ArrowRight size={16} />
              </button>
            </div>
          )}
        </section>
        <section className="customer-how-panel">
          <span className="customer-kicker">GOOD THINGS, MADE SIMPLE</span>
          <h2>From menu to you.</h2>
          {[
            {
              n: '01',
              title: 'Choose your favorites',
              text: 'Browse the menu and build your pickup bag.',
            },
            {
              n: '02',
              title: 'Follow your order',
              text: 'See when it’s confirmed, preparing and ready.',
            },
            {
              n: '03',
              title: 'Collect & enjoy',
              text: 'Pick up in store and pay cash when you collect.',
            },
          ].map((s) => (
            <div className="customer-how-step" key={s.n}>
              <span>{s.n}</span>
              <div>
                <b>{s.title}</b>
                <p>{s.text}</p>
              </div>
            </div>
          ))}
          <div className="customer-account-link">
            <UserRound size={20} />
            <div>
              <b>Your account</b>
              <small>View your profile and sign out.</small>
            </div>
            <button aria-label="Open my account" onClick={() => navigate('account')}>
              <ArrowUpRight size={19} />
            </button>
          </div>
        </section>
      </div>
      <div className="customer-panel-heading customer-menu-heading">
        <div>
          <span className="customer-kicker">FRESH FROM THE MENU</span>
          <h2>Find your next favorite</h2>
        </div>
        <button className="customer-text-link" onClick={() => navigate('shop')}>
          Browse all <ArrowUpRight size={15} />
        </button>
      </div>
      <div className="customer-featured">
        {favorite.map((p, i) => (
          <article key={p.id} className="customer-featured-card">
            <div className={`customer-featured-art color-${i % 5}`}>
              {p.image_path ? (
                <img src={`/api/products/${p.id}/image`} alt={p.name} />
              ) : (
                <span aria-hidden="true">{p.emoji}</span>
              )}
              <span
                className={`customer-featured-badge ${p.stock < 5 ? 'featured-low-stock' : 'featured-in-stock'}`}
              >
                {p.stock < 5 ? `Only ${p.stock} left` : 'In stock'}
              </span>
            </div>
            <div className="customer-featured-info">
              <h3>{p.name}</h3>
              <span>
                <b>{money(p.price_cents)}</b>
                <button
                  type="button"
                  className="featured-add"
                  disabled={busy || (cart[p.id] || 0) >= p.stock}
                  onClick={() => onAdd(p.id)}
                  aria-label={`Add ${p.name} to order bag`}
                >
                  Add +
                </button>
              </span>
              {!!cart[p.id] && (
                <small className="featured-bag-count">{cart[p.id]} in your bag</small>
              )}
            </div>
          </article>
        ))}
      </div>
      {!favorite.length && (
        <div className="customer-home-panel customer-menu-empty">
          <Coffee size={26} />
          <p>Fresh products will appear here when they’re available.</p>
        </div>
      )}
    </div>
  );
}
