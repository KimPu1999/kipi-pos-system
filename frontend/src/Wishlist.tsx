import { Heart, Plus, Minus, ShoppingBag } from './icons';
type Product = {
  id: number;
  name: string;
  sku: string;
  category: string;
  price_cents: number;
  small_price_cents: number | null;
  medium_price_cents: number | null;
  large_price_cents: number | null;
  stock: number;
  emoji: string;
  image_path: string | null;
  active: boolean | number;
};
type ProductSize = 'small' | 'medium' | 'large';
type Notice = {
  id: number;
  product_id: number;
  type: string;
  customer_count: number;
  read_at: string | null;
  created_at: string;
  product_name: string;
  product_emoji: string;
  product_category: string;
};
type Props = {
  products: Product[];
  wishlist: number[];
  cart: Record<number, number>;
  sizes: Record<number, ProductSize>;
  notices: Notice[];
  onToggle: (productId: number) => void;
  onAdd: (productId: number, delta: number) => void;
  onBrowse: () => void;
};
const money = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'MMK',
    currencyDisplay: 'code',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value / 100);
const sizePrice = (product: Product, size: ProductSize) =>
  (size === 'small'
    ? product.small_price_cents
    : size === 'large'
      ? product.large_price_cents
      : product.medium_price_cents) ?? product.price_cents;
export default function Wishlist({
  products,
  wishlist,
  cart,
  sizes,
  notices,
  onToggle,
  onAdd,
  onBrowse,
}: Props) {
  const saved = products.filter((p) => wishlist.includes(p.id));
  return (
    <section className="wishlist-page">
      <header className="wishlist-header">
        <h2>
          <Heart size={22} filled />
          Wishlist
        </h2>
        <p>
          {saved.length} {saved.length === 1 ? 'item' : 'items'} saved
        </p>
      </header>
      {notices.length > 0 && (
        <ul className="wishlist-notices">
          {notices.map((n) => (
            <li key={n.id} className={n.read_at ? 'read' : 'unread'}>
              <span className="wishlist-notice-emoji">{n.product_emoji}</span>
              <span>
                <strong>{n.product_name}</strong>
                <small>
                  Great news — it's back in stock.
                  {n.customer_count > 0 &&
                    ` ${n.customer_count} ${n.customer_count === 1 ? 'customer has' : 'customers have'} this on their wishlist.`}
                </small>
              </span>
            </li>
          ))}
        </ul>
      )}
      {!saved.length ? (
        <div className="dashboard-empty">
          <Heart size={30} />
          <h3>Your wishlist is waiting</h3>
          <p>Tap the heart on any product to save it here for later.</p>
          <button className="secondary" type="button" onClick={onBrowse}>
            Browse the menu
          </button>
        </div>
      ) : (
        <div className="product-grid">
          {saved.map((p, i) => (
            <article className="product customer-product" key={p.id}>
              <div className={`product-art color-${i % 5}`}>
                {p.image_path ? (
                  <img src={`/api/products/${p.id}/image`} alt={p.name} />
                ) : (
                  <span aria-hidden="true">{p.emoji}</span>
                )}
                <button
                  type="button"
                  className={`shop-card-heart active`}
                  aria-label={`Remove ${p.name} from wishlist`}
                  aria-pressed="true"
                  title="Remove from wishlist"
                  onClick={() => onToggle(p.id)}
                >
                  <Heart size={17} filled />
                </button>
                <small
                  className={
                    p.stock === 0
                      ? 'shop-stock-sold-out'
                      : p.stock < 5
                        ? 'shop-stock-low'
                        : 'shop-stock-available'
                  }
                >
                  {p.stock === 0 ? 'Sold out' : p.stock < 5 ? `Only ${p.stock} left` : 'Available'}
                </small>
              </div>
              <div className="product-info">
                <small>{p.category}</small>
                <h3>{p.name}</h3>
                <div>
                  <b>{money(sizePrice(p, sizes[p.id] || 'medium'))}</b>
                  {cart[p.id] ? (
                    <span className="shop-card-stepper">
                      <button
                        type="button"
                        aria-label={`Remove one ${p.name}`}
                        onClick={() => onAdd(p.id, -1)}
                      >
                        <Minus size={13} />
                      </button>
                      <span>{cart[p.id]}</span>
                      <button
                        type="button"
                        aria-label={`Add one ${p.name}`}
                        disabled={cart[p.id] >= p.stock}
                        onClick={() => onAdd(p.id, 1)}
                      >
                        <Plus size={13} />
                      </button>
                    </span>
                  ) : (
                    <button
                      className="shop-add"
                      aria-label={`Add ${p.name} to order`}
                      disabled={p.stock <= 0}
                      onClick={() => onAdd(p.id, 1)}
                    >
                      <Plus size={14} />
                      {p.stock === 0 ? 'Sold out' : 'Add to bag'}
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <button type="button" className="secondary wishlist-browse-bag" onClick={onBrowse}>
        <ShoppingBag size={17} />
        Back to shop
      </button>
    </section>
  );
}
