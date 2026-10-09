import TableChoice from './TableChoice';
import { Search, Plus, Minus, Trash2, ShoppingBag, Clock, Banknote, ArrowRight } from './icons';
import PromotionBanners from './PromotionBanners';
import type { Promotion } from './Promotions';
import OrderContactFields, { type OrderContact } from './OrderContactFields';
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
export type ProductSize = 'small' | 'medium' | 'large';
type Props = {
  taxPercent: number;
  view: 'shop' | 'bag';
  onContinue: () => void;
  transferProvider: 'kbzpay' | 'ayapay';
  setTransferProvider: (value: 'kbzpay' | 'ayapay') => void;
  transferName: string;
  transferPhone: string;
  setTransferName: (value: string) => void;
  setTransferPhone: (value: string) => void;
  paymentChoice: 'cash' | 'card' | 'transfer';
  setPaymentChoice: (choice: 'cash' | 'card' | 'transfer') => void;
  tables: {
    id: number;
    name: string;
    seats: number;
    area: string;
    status: 'available' | 'occupied' | 'reserved';
  }[];
  tableId: number | null;
  setTableId: (id: number | null) => void;
  promotions: Promotion[];
  promotionCode: string;
  setPromotionCode: (value: string) => void;
  serviceType: 'dine_in' | 'takeaway';
  setServiceType: (value: 'dine_in' | 'takeaway') => void;
  contact: OrderContact;
  setContact: (value: OrderContact) => void;
  products: Product[];
  cart: Record<number, number>;
  setCart: React.Dispatch<React.SetStateAction<Record<number, number>>>;
  sizes: Record<number, ProductSize>;
  setSizes: React.Dispatch<React.SetStateAction<Record<number, ProductSize>>>;
  search: string;
  setSearch: (value: string) => void;
  category: string;
  setCategory: (value: string) => void;
  note: string;
  setNote: (value: string) => void;
  busy: boolean;
  loading: boolean;
  place: () => void;
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
const availableSizes = (product: Product): ProductSize[] => {
  const sizes = (['small', 'medium', 'large'] as const).filter((size) => {
    const price =
      size === 'small'
        ? product.small_price_cents
        : size === 'large'
          ? product.large_price_cents
          : product.medium_price_cents;
    return price !== null && price !== undefined;
  });
  return sizes.length ? [...sizes] : ['medium'];
};
const selectedSize = (product: Product, size?: ProductSize) => {
  const available = availableSizes(product);
  return size && available.includes(size)
    ? size
    : available.includes('medium')
      ? 'medium'
      : available[0];
};
const shopPrice = (product: Product) => {
  const available = availableSizes(product);
  const price = Math.min(...available.map((size) => sizePrice(product, size)));
  return `${available.length > 1 ? 'From ' : ''}${money(price)}`;
};
export default function CustomerShop({
  taxPercent,
  view,
  onContinue,
  transferProvider,
  setTransferProvider,
  transferName,
  transferPhone,
  setTransferName,
  setTransferPhone,
  paymentChoice,
  setPaymentChoice,
  tables,
  tableId,
  setTableId,
  promotions,
  promotionCode,
  setPromotionCode,
  serviceType,
  setServiceType,
  contact,
  setContact,
  products,
  cart,
  setCart,
  sizes,
  setSizes,
  search,
  setSearch,
  category,
  setCategory,
  note,
  setNote,
  busy,
  loading,
  place,
}: Props) {
  const shown = products.filter(
    (p) =>
      (category === 'All' || p.category === category) &&
      `${p.name} ${p.sku}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const count = Object.values(cart).reduce((sum, n) => sum + n, 0);
  const total = products.reduce(
    (sum, p) => sum + sizePrice(p, selectedSize(p, sizes[p.id])) * (cart[p.id] || 0),
    0,
  );
  const promo = promotions.find(
    (p) =>
      p.code === promotionCode.trim().toUpperCase() &&
      p.active &&
      (!p.expires_on || p.expires_on >= new Date().toISOString().slice(0, 10)),
  );
  const eligible = promo
    ? products.filter(
        (p) => cart[p.id] && (!promo.product_ids.length || promo.product_ids.includes(p.id)),
      )
    : [];
  const eligibleTotal = eligible.reduce(
    (n, p) => n + sizePrice(p, selectedSize(p, sizes[p.id])) * cart[p.id],
    0,
  );
  const discount = promo ? Math.min(total, Math.round((eligibleTotal * promo.percent) / 100)) : 0;
  const tax = Math.round(((total - discount) * taxPercent) / 100),
    grandTotal = total - discount + tax;
  const unavailable = Object.entries(cart).some(([id, n]) => {
    const p = products.find((p) => p.id === Number(id));
    return !p || !p.active || n > p.stock;
  });
  function remove(id: number) {
    setCart((c) => {
      const next = { ...c };
      delete next[id];
      return next;
    });
    setSizes((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }
  function change(p: Product, delta: number) {
    setCart((c) => {
      const next = { ...c };
      const quantity = (c[p.id] || 0) + delta;
      if (quantity <= 0) delete next[p.id];
      else if (quantity <= p.stock) next[p.id] = quantity;
      return next;
    });
    if (delta > 0) {
      setSizes((current) => (current[p.id] ? current : { ...current, [p.id]: selectedSize(p) }));
    } else if ((cart[p.id] || 0) + delta <= 0) {
      setSizes((current) => {
        const next = { ...current };
        delete next[p.id];
        return next;
      });
    }
  }
  return (
    <div
      className={`store-layout customer-shop ${view === 'bag' ? 'customer-bag-page' : 'customer-catalog-page'}`}
    >
      {view === 'shop' && (
        <section>
          <div className="store-hero">
            <div>
              <span className="eyebrow">YOUR DAILY DOSE OF SOMETHING GOOD</span>
              <h2>
                Fresh favorites.
                <br />
                One easy pickup.
              </h2>
              <p>Choose your treats. We’ll get them ready.</p>
              <div className="shop-promises">
                <span>
                  <Clock size={14} /> Order ahead
                </span>
                <span>
                  <Banknote size={14} /> Pay at pickup
                </span>
              </div>
            </div>
            <span className="hero-emoji" aria-hidden="true">
              🥐
            </span>
          </div>
          <PromotionBanners products={products} items={promotions} onSelect={setPromotionCode} />
          <div className="shop-catalog-title">
            <h2>Explore the menu</h2>
            <span>{shown.length} products</span>
          </div>
          <label className="search">
            <Search size={18} />
            <input
              aria-label="Search products"
              placeholder="Search coffee, treats and more…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} aria-label="Clear search">
                Clear
              </button>
            )}
          </label>
          <div className="categories">
            {['All', ...new Set(products.map((p) => p.category))].map((c) => (
              <button
                className={category === c ? 'selected' : ''}
                key={c}
                onClick={() => setCategory(c)}
              >
                {c === 'All' ? 'All products' : c}
              </button>
            ))}
          </div>
          <div className="product-grid">
            {shown.map((p, i) => (
              <article className="product customer-product" key={p.id}>
                <div className={`product-art color-${i % 5}`}>
                  <>
                    {p.image_path ? (
                      <img src={`/api/products/${p.id}/image`} alt={p.name} />
                    ) : (
                      <span aria-hidden="true">{p.emoji}</span>
                    )}
                  </>
                  <small
                    className={
                      p.stock === 0
                        ? 'shop-stock-sold-out'
                        : p.stock < 5
                          ? 'shop-stock-low'
                          : 'shop-stock-available'
                    }
                  >
                    {p.stock === 0
                      ? 'Sold out'
                      : p.stock < 5
                        ? `Only ${p.stock} left`
                        : 'Available'}
                  </small>
                </div>
                <div className="product-info">
                  <small>{p.category}</small>
                  <h3>{p.name}</h3>
                  {promotions
                    .filter((offer) => offer.active && offer.product_ids.includes(p.id))
                    .map((offer) => (
                      <span className="product-promo-label" key={offer.id}>
                        {offer.percent}% off · {offer.code}
                      </span>
                    ))}
                  <div>
                    <b>{shopPrice(p)}</b>
                    <button
                      className="shop-add"
                      aria-label={`Add ${p.name} to order`}
                      disabled={busy || loading || p.stock <= (cart[p.id] || 0)}
                      onClick={() => change(p, 1)}
                    >
                      <Plus size={14} />
                      {p.stock === 0 ? 'Sold out' : 'Add'}
                    </button>
                  </div>
                  {!!cart[p.id] && <p className="in-cart">{cart[p.id]} in your order</p>}
                </div>
              </article>
            ))}
          </div>
          {!shown.length && !loading && (
            <div className="dashboard-empty">
              <ShoppingBag size={30} />
              <h3>{products.length ? 'No matching favorites' : 'The menu is on its way'}</h3>
              <p>
                {products.length
                  ? 'Try another search or category.'
                  : 'Check back soon for fresh products.'}
              </p>
              {products.length > 0 && (
                <button
                  className="secondary"
                  onClick={() => {
                    setSearch('');
                    setCategory('All');
                  }}
                >
                  Show all products
                </button>
              )}
            </div>
          )}
        </section>
      )}
      {view === 'bag' && (
        <aside
          id="customer-order-bag"
          tabIndex={-1}
          aria-label="Your order bag"
          className="shop-cart panel"
        >
          <div className="shop-cart-title">
            <div className="shop-cart-title-copy">
              <h2>Your order bag</h2>
              <p>Review your items and complete your order.</p>
            </div>
            <div className="shop-cart-header-actions">
              <span className="bag-count" aria-label={`${count} items in bag`}>
                {count} {count === 1 ? 'item' : 'items'}
              </span>
              <button type="button" className="secondary" onClick={onContinue}>
                Continue shopping
              </button>
              {count > 0 && (
                <button
                  type="button"
                  className="clear-order customer-clear-bag"
                  disabled={busy}
                  onClick={() => {
                    setCart({});
                    setSizes({});
                    setNote('');
                  }}
                >
                  <Trash2 size={16} /> Clear bag
                </button>
              )}
            </div>
          </div>
          <div className="shop-cart-lines">
            {Object.entries(cart).map(([id, n]) => {
              const p = products.find((p) => p.id === Number(id));
              return (
                <div className="cart-item customer-cart-item" key={id}>
                  <span className="cart-emoji">
                    {p?.image_path ? (
                      <img src={`/api/products/${p.id}/image`} alt="" />
                    ) : (
                      p?.emoji || '📦'
                    )}
                  </span>
                  <div className="cart-item-info">
                    <b>{p?.name || 'Unavailable product'}</b>
                    {p && <span className="customer-cart-category">{p.category}</span>}
                    <small className="customer-unit-price">
                      {p
                        ? `${money(sizePrice(p, selectedSize(p, sizes[p.id])))} each`
                        : 'Remove this item to continue'}
                    </small>
                    {p && (
                      <>
                        <fieldset className="bag-size-picker">
                          <legend>Choose size</legend>
                          <div>
                            {availableSizes(p).map((size) => (
                              <button
                                type="button"
                                key={size}
                                className={selectedSize(p, sizes[p.id]) === size ? 'selected' : ''}
                                aria-pressed={selectedSize(p, sizes[p.id]) === size}
                                disabled={busy}
                                onClick={() =>
                                  setSizes((current) => ({ ...current, [p.id]: size }))
                                }
                              >
                                {size.charAt(0).toUpperCase() + size.slice(1)}
                              </button>
                            ))}
                          </div>
                        </fieldset>
                        <div className="stepper">
                          <button
                            aria-label={`Remove one ${p.name}`}
                            disabled={busy}
                            onClick={() => change(p, -1)}
                          >
                            <Minus size={13} />
                          </button>
                          <span>{n}</span>
                          <button
                            aria-label={`Add one ${p.name}`}
                            disabled={busy || n >= p.stock}
                            onClick={() => change(p, 1)}
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="cart-line-end">
                    {p && (
                      <span className="customer-line-price">
                        <small>Item total</small>
                        <b>{money(sizePrice(p, selectedSize(p, sizes[p.id])) * n)}</b>
                      </span>
                    )}
                    <button
                      type="button"
                      className="remove customer-remove-item"
                      title="Remove item"
                      aria-label={`Remove ${p?.name || 'unavailable product'} from bag`}
                      disabled={busy}
                      onClick={() => remove(Number(id))}
                    >
                      <Trash2 size={17} />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {!count && (
            <div className="dashboard-empty">
              <ShoppingBag size={30} />
              <h3>Your bag is waiting</h3>
              <p>Add a favorite from the menu to get started.</p>
            </div>
          )}
          <form
            className="customer-checkout-form"
            onSubmit={(e) => {
              e.preventDefault();
              place();
            }}
          >
            <fieldset className="service-choice">
              <legend>How would you like your order?</legend>
              <div>
                <button
                  type="button"
                  aria-pressed={serviceType === 'dine_in'}
                  className={serviceType === 'dine_in' ? 'selected' : ''}
                  disabled={busy}
                  onClick={() => setServiceType('dine_in')}
                >
                  🍽️ Dine in
                </button>
                <button
                  type="button"
                  aria-pressed={serviceType === 'takeaway'}
                  className={serviceType === 'takeaway' ? 'selected' : ''}
                  disabled={busy}
                  onClick={() => setServiceType('takeaway')}
                >
                  🛍️ Takeaway
                </button>
              </div>
            </fieldset>
            {serviceType === 'dine_in' && (
              <TableChoice
                tables={tables}
                tableId={tableId}
                onChange={setTableId}
                disabled={busy || loading}
              />
            )}
            {serviceType === 'takeaway' && (
              <OrderContactFields value={contact} onChange={setContact} disabled={busy} />
            )}
            <label className="order-note">
              Pickup note <span className="muted">Optional</span>
              <textarea
                value={note}
                maxLength={500}
                disabled={busy}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Anything we should know?"
              />
            </label>
            <label className="order-note">
              Promotion code (optional)
              <input
                value={promotionCode}
                maxLength={40}
                onChange={(e) => setPromotionCode(e.target.value.toUpperCase())}
                disabled={busy}
                placeholder="Enter discount code"
              />
            </label>
            {promotionCode && !promo && (
              <p className="order-warning" role="alert">
                This code is unavailable. Clear it or enter an active code.
              </p>
            )}
            {promo && promo.product_ids.length > 0 && !eligible.length && (
              <p className="order-warning">Add a qualifying product to use this code.</p>
            )}
            {promo && (
              <div className="receipt-line">
                <span>{promo.percent}% discount</span>
                <b>−{money(discount)}</b>
              </div>
            )}
            <div className="receipt-line tax-line">
              <span>Tax ({taxPercent}%)</span>
              <b>{money(tax)}</b>
            </div>
            <div className="receipt-line total">
              <b>Order total</b>
              <b>{money(grandTotal)}</b>
            </div>
            <fieldset className="service-choice">
              <legend>Payment method</legend>
              <div className="customer-payment-methods">
                <button
                  type="button"
                  className={paymentChoice === 'cash' ? 'selected' : ''}
                  aria-pressed={paymentChoice === 'cash'}
                  disabled={busy}
                  onClick={() => setPaymentChoice('cash')}
                >
                  💵 Cash
                </button>
                <button
                  type="button"
                  className={paymentChoice === 'card' ? 'selected' : ''}
                  aria-pressed={paymentChoice === 'card'}
                  disabled={busy}
                  onClick={() => setPaymentChoice('card')}
                >
                  💳 Card
                </button>
                <button
                  type="button"
                  className={paymentChoice === 'transfer' ? 'selected' : ''}
                  aria-pressed={paymentChoice === 'transfer'}
                  disabled={busy}
                  onClick={() => setPaymentChoice('transfer')}
                >
                  📱 Online
                </button>
              </div>
              {paymentChoice === 'cash' && (
                <section className="order-payment-info">
                  <h3>Cash payment</h3>
                  <p>Pay with cash when you collect your order.</p>
                </section>
              )}
              {paymentChoice === 'card' && (
                <section className="order-payment-info">
                  <h3>Card payment</h3>
                  <p>Pay using the card terminal when you collect your order.</p>
                </section>
              )}
              {paymentChoice === 'transfer' && (
                <section className="online-payment-panel">
                  <h3>Choose online wallet</h3>
                  <div className="online-wallet-options">
                    {(['kbzpay', 'ayapay'] as const).map((provider) => (
                      <button
                        type="button"
                        key={provider}
                        className={transferProvider === provider ? 'selected' : ''}
                        aria-pressed={transferProvider === provider}
                        disabled={busy}
                        onClick={() => setTransferProvider(provider)}
                      >
                        {provider === 'kbzpay' ? 'KBZPay' : 'AYA Pay'}
                      </button>
                    ))}
                  </div>
                  <section className="order-payment-info">
                    <h3>{transferProvider === 'kbzpay' ? 'KBZPay' : 'AYA Pay'} account</h3>
                    <dl>
                      <div>
                        <dt>Name</dt>
                        <dd>Thawng Kim Piang</dd>
                      </div>
                      <div>
                        <dt>Phone</dt>
                        <dd>
                          <a href="tel:09428981899">09428981899</a>
                        </dd>
                      </div>
                      <div>
                        <dt>Amount</dt>
                        <dd>{money(grandTotal)}</dd>
                      </div>
                    </dl>
                    <p className="muted">
                      Check the account name before transferring. Staff will verify the payment
                      manually.
                    </p>
                  </section>
                </section>
              )}
            </fieldset>
            {unavailable && (
              <p role="alert" className="order-warning">
                Stock has changed. Reduce the quantity or remove unavailable items.
              </p>
            )}
            <button
              className="checkout"
              disabled={
                busy ||
                loading ||
                !count ||
                unavailable ||
                (serviceType === 'dine_in' &&
                  !tables.some((t) => t.id === tableId && t.status === 'available')) ||
                !!(promotionCode && !promo) ||
                !!(promo?.product_ids.length && !eligible.length)
              }
              type="submit"
            >
              {busy ? 'Placing your order…' : 'Place order'}
              <ArrowRight size={16} />
            </button>
            <p className="shop-cart-footnote">
              Track your order and payment verification in My orders.
            </p>
          </form>
        </aside>
      )}
    </div>
  );
}
