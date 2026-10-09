import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { api, type User } from './api';
import BrandLogo from './BrandLogo';
import {
  ArrowUpRight,
  Banknote,
  Coffee,
  CreditCard,
  LayoutGrid,
  Minus,
  Package,
  Plus,
  Printer,
  Receipt,
  Search,
  ShoppingBag,
  Trash2,
} from './icons';
import OrderContactFields, { type OrderContact } from './OrderContactFields';
import { productSku } from './productSku';
import TableChoice from './TableChoice';
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
type Sale = {
  id: number;
  cardholder_name: string | null;
  card_last_four: string | null;
  contact_name: string | null;
  contact_email: string | null;
  phone: string | null;
  location: string | null;
  zip_code: string | null;
  service_type: string;
  table_name: string | null;
  discount_cents: number;
  tax_percent: number;
  tax_cents: number;
  promotion_code: string | null;
  total_cents: number;
  amount_received_cents: number | null;
  change_cents: number;
  payment_method: string;
  created_at: string;
  items: { name: string; quantity: number; price_cents: number; size: ProductSize }[];
};
type CartItem = { product: Product; quantity: number; size: ProductSize };
const money = (c: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'MMK',
    currencyDisplay: 'code',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(c / 100);
const sizePrice = (product: Product, size: ProductSize) =>
  (size === 'small'
    ? product.small_price_cents
    : size === 'large'
      ? product.large_price_cents
      : product.medium_price_cents) ?? product.price_cents;
const sizeOptions = (product: Product): ProductSize[] => {
  const options: ProductSize[] = [];
  if ((product.small_price_cents ?? 0) > 0) options.push('small');
  if ((product.medium_price_cents ?? 0) > 0) options.push('medium');
  if ((product.large_price_cents ?? 0) > 0) options.push('large');
  return options;
};
const defaultSize = (product: Product): ProductSize => {
  const options = sizeOptions(product);
  return options.includes('medium') ? 'medium' : options[0] || 'medium';
};
const sizePriceInput = (product: Product | null, size: ProductSize) => {
  if (!product) return '';
  const price =
    size === 'small'
      ? product.small_price_cents
      : size === 'large'
        ? product.large_price_cents
        : product.medium_price_cents;
  return price === null ? '' : (price ?? product.price_cents) / 100;
};
const cartItemWithProduct = (item: CartItem, product: Product): CartItem => ({
  ...item,
  product,
  size: sizeOptions(product).includes(item.size) ? item.size : defaultSize(product),
});
export default function App({
  user,
  logout,
  visible = true,
  bagPage = false,
  onCartCount,
  onContinue,
  onOpenBag,
  page = 'register',
  onNavigate,
}: {
  user: User;
  logout: ReactNode;
  onOpenBag?: () => void;
  page?: string;
  onNavigate?: (page: string) => void;
  visible?: boolean;
  bagPage?: boolean;
  onCartCount?: (count: number) => void;
  onContinue?: () => void;
}) {
  const [products, setProducts] = useState<Product[]>([]),
    [sales, setSales] = useState<Sale[]>([]),
    [cart, setCart] = useState<CartItem[]>([]),
    [tab, setTab] = useState('register'),
    [category, setCategory] = useState('All products'),
    [search, setSearch] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [payment, setPayment] = useState('cash'),
    [receipt, setReceipt] = useState<Sale | null>(null),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    onCartCount?.(cart.reduce((sum, item) => sum + item.quantity, 0));
  }, [cart, onCartCount]);
  useEffect(() => {
    setTab(bagPage ? 'bag' : page);
  }, [bagPage, page]);
  const receiptPanel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!receipt) return;
    const previous = document.activeElement as HTMLElement | null;
    receiptPanel.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setReceipt(null);
      }
      if (event.key === 'Tab') {
        const buttons = receiptPanel.current?.querySelectorAll<HTMLButtonElement>('button');
        if (!buttons?.length) return;
        const first = buttons[0],
          last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last || document.activeElement === receiptPanel.current)
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('keydown', key);
      previous?.focus();
    };
  }, [receipt]);
  useEffect(() => {
    if (!visible) setReceipt(null);
  }, [visible]);
  const [serviceType, setServiceType] = useState<'dine_in' | 'takeaway'>('takeaway'),
    [tableId, setTableId] = useState<number | null>(null),
    [tables, setTables] = useState<
      {
        id: number;
        name: string;
        seats: number;
        area: string;
        status: 'available' | 'occupied' | 'reserved';
      }[]
    >([]);
  const [contact, setContact] = useState<OrderContact>({
    name: '',
    email: '',
    phone: '',
    location: '',
    zip_code: '',
  });
  const validContact =
    serviceType === 'dine_in' ||
    (Object.values(contact).every((v) => v.trim()) &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email));
  const validTable =
    serviceType === 'takeaway' || tables.some((t) => t.id === tableId && t.status === 'available');
  const [salesPage, setSalesPage] = useState(1);
  const salesPages = Math.max(1, Math.ceil(sales.length / 10));
  const currentSalesPage = Math.min(salesPage, salesPages);
  const pageSales = sales.slice((currentSalesPage - 1) * 10, currentSalesPage * 10);
  const [cashReceived, setCashReceived] = useState(''),
    [customDiscount, setCustomDiscount] = useState(''),
    [taxPercent, setTaxPercent] = useState(0);
  const submitting = useRef(false);
  const [inventory, setInventory] = useState<Product[]>([]);
  const [inventoryPage, setInventoryPage] = useState(1);
  const inventoryPages = Math.max(1, Math.ceil(inventory.length / 10));
  const currentInventoryPage = Math.min(inventoryPage, inventoryPages);
  const inventoryItems = inventory.slice(
    (currentInventoryPage - 1) * 10,
    currentInventoryPage * 10,
  );
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (deleteProduct) deleteDialog.current?.showModal();
    else deleteDialog.current?.close();
  }, [deleteProduct]);
  async function removeProduct() {
    if (!deleteProduct || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setStockError('');
    try {
      await api(`/products/${deleteProduct.id}/permanent`, {
        method: 'DELETE',
      });
      const id = deleteProduct.id;
      setInventory((items) => items.filter((p) => p.id !== id));
      setProducts((items) => items.filter((p) => p.id !== id));
      setCart((items) => items.filter((i) => i.product.id !== id));
      setDeleteProduct(null);
      setStockNotice('Product deleted.');
    } catch (e) {
      setStockError(e instanceof Error ? e.message : 'Unable to delete product.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const productEditor = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (editProduct) productEditor.current?.showModal();
    else productEditor.current?.close();
  }, [editProduct]);
  async function saveInventoryProduct(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editProduct || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setStockError('');
    const data = new FormData(e.currentTarget);
    data.set('_method', 'PUT');
    data.set('sku', editProduct.sku);
    data.set('expected_stock', String(editProduct.stock));
    data.set('active', data.has('active') ? '1' : '0');
    for (const size of ['small', 'medium', 'large']) {
      const value = String(data.get(`${size}_price`) || '').trim();
      data.set(`${size}_price_cents`, value === '' ? '' : String(Math.round(Number(value) * 100)));
      data.delete(`${size}_price`);
    }
    data.set(
      'price_cents',
      String(
        data.get('medium_price_cents') ||
          data.get('small_price_cents') ||
          data.get('large_price_cents') ||
          '',
      ),
    );
    const image = data.get('image');
    if (image instanceof File && !image.size) data.delete('image');
    try {
      const saved = await api<Product>(`/products/${editProduct.id}`, {
        method: 'POST',
        body: data,
      });
      setInventory((items) => items.map((p) => (p.id === saved.id ? saved : p)));
      setProducts((items) => [
        ...items.filter((p) => p.id !== saved.id),
        ...(saved.active ? [saved] : []),
      ]);
      setCart((items) =>
        items.map((item) =>
          item.product.id === saved.id ? cartItemWithProduct(item, saved) : item,
        ),
      );
      setEditProduct(null);
      setStockNotice('Product updated. SKU stays unchanged.');
    } catch (e) {
      setStockError(e instanceof Error ? e.message : 'Unable to update product.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  const [stockError, setStockError] = useState('');
  const [stockNotice, setStockNotice] = useState('');
  async function toggleInventoryStatus(product: Product) {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setStockError('');
    setStockNotice('');
    try {
      const saved = await api<Product>(`/products/${product.id}/active`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !product.active }),
      });
      setInventory((items) => items.map((item) => (item.id === saved.id ? saved : item)));
      setProducts((items) =>
        saved.active
          ? [...items.filter((item) => item.id !== saved.id), saved]
          : items.filter((item) => item.id !== saved.id),
      );
      setCart((items) =>
        saved.active
          ? items.map((item) =>
              item.product.id === saved.id ? cartItemWithProduct(item, saved) : item,
            )
          : items.filter((item) => item.product.id !== saved.id),
      );
      setStockNotice(`${saved.name} is now ${saved.active ? 'active' : 'inactive'}.`);
    } catch (e) {
      setStockError(e instanceof Error ? e.message : 'Unable to change product status.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [cardConfirmed, setCardConfirmed] = useState(false),
    [cardName, setCardName] = useState(''),
    [cardLastFour, setCardLastFour] = useState('');
  const paymentDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (paymentOpen) paymentDialog.current?.showModal();
    else paymentDialog.current?.close();
  }, [paymentOpen]);
  function openPayment() {
    if (submitting.current || busy || loading || !cart.length || invalidStock) return;
    setError('');
    setCardName('');
    setCardLastFour('');
    if (!validDiscount) {
      setError('Discount must be between 0% and 100%.');
      return;
    }
    if (!validContact) {
      setError('Complete the takeaway customer details, including a valid email.');
      return;
    }
    if (!validTable) {
      setError('Choose an available dining table.');
      return;
    }
    setCardConfirmed(false);
    setPaymentOpen(true);
  }
  function cancelPayment() {
    if (!submitting.current) setPaymentOpen(false);
  }

  async function refresh() {
    const [p, s, t, settings] = await Promise.all([
      api<Product[]>('/products'),
      api<Sale[]>('/sales'),
      api<
        {
          id: number;
          name: string;
          seats: number;
          area: string;
          status: 'available' | 'occupied' | 'reserved';
        }[]
      >('/table-choices'),
      api<{ tax_percent: number }>('/settings'),
    ]);
    setTaxPercent(settings.tax_percent);
    setTables(t);
    setInventory(p);
    setProducts(p.filter((x) => x.active));
    setSales(s);
    setCart((c) =>
      c.map((i) => {
        const product = p.find((x) => x.id === i.product.id) || {
          ...i.product,
          active: false,
          stock: 0,
        };
        return cartItemWithProduct(i, product);
      }),
    );
  }
  useEffect(() => {
    refresh()
      .catch((e) => setError(e.message + ' — check that the Laravel API is running.'))
      .finally(() => setLoading(false));
  }, []);
  function add(p: Product) {
    if (submitting.current) return;
    setCart((c) => {
      const old = c.find((i) => i.product.id === p.id);
      if ((old?.quantity || 0) >= p.stock) return c;
      return old
        ? c.map((i) => (i.product.id === p.id ? { ...i, quantity: i.quantity + 1 } : i))
        : [...c, { product: p, quantity: 1, size: defaultSize(p) }];
    });
  }
  function setItemSize(id: number, size: ProductSize) {
    if (submitting.current) return;
    setCart((items) => items.map((item) => (item.product.id === id ? { ...item, size } : item)));
  }
  function quantity(id: number, delta: number) {
    if (submitting.current) return;
    setCart((c) =>
      c
        .map((i) =>
          i.product.id === id
            ? { ...i, quantity: Math.min(i.product.stock, i.quantity + delta) }
            : i,
        )
        .filter((i) => i.quantity > 0),
    );
  }
  const subtotal = cart.reduce((s, i) => s + sizePrice(i.product, i.size) * i.quantity, 0);
  const discountPercent = customDiscount.trim() === '' ? 0 : Number(customDiscount);
  const validDiscount =
    Number.isFinite(discountPercent) && discountPercent >= 0 && discountPercent <= 100;
  const discount = validDiscount ? Math.round((subtotal * discountPercent) / 100) : 0;
  const tax = Math.round(((subtotal - (validDiscount ? discount : 0)) * taxPercent) / 100);
  const total = subtotal - (validDiscount ? discount : 0) + tax;
  function editQuantity(id: number, value: number) {
    if (submitting.current) return;
    setCart((c) =>
      c.map((i) =>
        i.product.id === id
          ? {
              ...i,
              quantity: Math.max(1, Math.min(i.product.stock || 1, Math.floor(value) || 1)),
            }
          : i,
      ),
    );
  }
  const received = cashReceived.trim() === '' ? total : Math.round(Number(cashReceived) * 100);
  const validCash = Number.isFinite(received) && received >= total && received <= 1000000000;
  const invalidStock = cart.some((i) => !i.product.active || i.quantity > i.product.stock);
  async function checkout() {
    if (
      submitting.current ||
      !cart.length ||
      !validDiscount ||
      !validContact ||
      !validTable ||
      invalidStock ||
      (payment === 'cash' && !validCash) ||
      (payment === 'card' && (!cardConfirmed || !!(cardLastFour && cardLastFour.length !== 4)))
    )
      return;
    submitting.current = true;
    setBusy(true);
    setError('');
    let completed = false;
    try {
      const sale = await api<Sale>('/sales', {
        method: 'POST',
        body: JSON.stringify({
          cardholder_name: payment === 'card' ? cardName || null : null,
          card_last_four: payment === 'card' ? cardLastFour || null : null,
          discount_percent: discountPercent,
          ...(serviceType === 'takeaway' ? { contact } : {}),
          service_type: serviceType,
          dining_table_id: serviceType === 'dine_in' ? tableId : null,
          payment_method: payment,
          amount_received_cents: payment === 'cash' ? received : null,
          items: cart.map((i) => ({
            product_id: i.product.id,
            quantity: i.quantity,
            size: i.size,
          })),
        }),
      });
      completed = true;
      setTableId(null);
      setPaymentOpen(false);
      setReceipt(sale);
      setContact({
        name: '',
        email: '',
        phone: '',
        location: '',
        zip_code: '',
      });
      setCart([]);
      setCashReceived('');
      setCustomDiscount('');
      setPayment('cash');
      // A refresh failure must never report a committed payment as failed.
      try {
        await refresh();
      } catch {
        setError(
          'Payment completed. Could not refresh inventory; press Retry before the next sale.',
        );
        setLoading(true);
      }
    } catch (e) {
      setPaymentOpen(false);
      setError(e instanceof Error ? e.message : 'Checkout failed');
      if (!completed) {
        try {
          await refresh();
        } catch {
          /* Keep the order for correction. */
        }
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  function productForm(d: FormData) {
    for (const size of ['small', 'medium', 'large']) {
      const value = String(d.get(`${size}_price`) || '').trim();
      d.set(`${size}_price_cents`, value === '' ? '' : String(Math.round(Number(value) * 100)));
      d.delete(`${size}_price`);
    }
    d.set(
      'price_cents',
      String(
        d.get('medium_price_cents') ||
          d.get('small_price_cents') ||
          d.get('large_price_cents') ||
          '',
      ),
    );
    d.set('emoji', '📦');
    const file = d.get('image');
    if (file instanceof File && !file.size) d.delete('image');
    return d;
  }
  async function createProduct(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const d = new FormData(form);
    setBusy(true);
    try {
      await api('/products', { method: 'POST', body: productForm(d) });
      await refresh();
      form.reset();
      const sku = form.querySelector<HTMLInputElement>('input[name=sku]');
      if (sku) {
        sku.value = productSku();
        sku.defaultValue = sku.value;
      }
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save product');
    } finally {
      setBusy(false);
    }
  }
  const productCategories = [
    ...new Set(inventory.map((product) => product.category.trim()).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));
  const filtered = products.filter(
    (p) =>
      (category === 'All products' || p.category === category) &&
      `${p.name} ${p.sku}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div
      hidden={!visible}
      className={`app pos-app ${bagPage ? 'admin-bag-page' : 'admin-catalog-page'}`}
    >
      <aside className="sidebar">
        <a className="brand" href="#">
          <BrandLogo showPos={false} />
        </a>
        <div className="workspace">
          <span className="store-icon">
            <Coffee size={20} />
          </span>
          <div>
            <b>The everyday store</b>
            <small>Main location</small>
          </div>
          <span className="online" />
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav>
          {[
            ['register', 'Point of sale', LayoutGrid],
            ['inventory', 'Inventory', Package],
            ['sales', 'Sales history', Receipt],
          ].map(([key, label, Icon]) => (
            <button
              key={String(key)}
              title={String(label)}
              aria-label={String(label)}
              data-label={String(label)}
              className={tab === key ? 'active' : ''}
              onClick={() => {
                setTab(String(key));
                onNavigate?.(String(key));
              }}
            >
              {typeof Icon !== 'string' && <Icon size={20} />}
              <span>{String(label)}</span>
              {tab === key && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help">
            <b>A little help?</b>
            <p>
              Everything you need to keep
              <br />
              your counter moving.
            </p>
            <a href="https://github.com/laravel/laravel" target="_blank" rel="noreferrer">
              Laravel documentation <ArrowUpRight size={15} />
            </a>
          </div>
          <div className="profile">
            <div className="avatar">{user.name.slice(0, 2).toUpperCase()}</div>
            <div>
              <b>{user.name}</b>
              <small>{user.email}</small>
            </div>
          </div>
          {logout}
        </div>
      </aside>
      <main>
        <header>
          <div>
            <span className="eyebrow">YOUR WORKSPACE, SIMPLIFIED</span>
            <h1>
              {tab === 'bag'
                ? 'Order bag'
                : tab === 'register'
                  ? 'Point of sale'
                  : tab === 'inventory'
                    ? 'Inventory'
                    : 'Sales history'}
            </h1>
            <p>
              {tab === 'register'
                ? 'Good things start at the Kipi POS Let’s make a sale.'
                : tab === 'inventory'
                  ? 'A little organization. A smoother day.'
                  : 'Every transaction, all in one place.'}
            </p>
          </div>
          <div className="date">
            <span className="online" /> Store open{' '}
            <small>
              {new Date().toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </small>
          </div>
        </header>
        {error && (
          <div className="error" role="alert">
            {error}
            <button
              onClick={() => {
                setLoading(true);
                refresh()
                  .then(() => setError(''))
                  .catch((e) => setError(e.message))
                  .finally(() => setLoading(false));
              }}
            >
              Retry
            </button>
          </div>
        )}
        {tab === 'register' || tab === 'bag' ? (
          <div className="register">
            {tab === 'register' && (
              <section className="catalog">
                <div className="section-heading">
                  <h2>
                    Product catalog <span>{products.length}</span>
                  </h2>
                  <button
                    type="button"
                    className="primary pos-review-bag"
                    disabled={!cart.length || busy || loading}
                    onClick={() => {
                      setTab('bag');
                      onOpenBag?.();
                    }}
                  >
                    <ShoppingBag size={18} /> Review bag (
                    {cart.reduce((sum, item) => sum + item.quantity, 0)})
                  </button>
                </div>
                <label className="search">
                  <Search size={19} />
                  <input
                    placeholder="Search products or scan a barcode…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <kbd>SKU</kbd>
                </label>
                <div className="categories">
                  {['All products', ...new Set(products.map((p) => p.category))].map((c) => (
                    <button
                      className={category === c ? 'selected' : ''}
                      onClick={() => setCategory(c)}
                      key={c}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="product-grid">
                  {filtered.map((p, i) => {
                    const inBag = cart.find((item) => item.product.id === p.id)?.quantity || 0;
                    return (
                      <div
                        key={p.id}
                        className={`product ${inBag ? 'pos-product-selected' : ''} ${!p.stock ? 'pos-product-disabled' : ''}`}
                      >
                        <button
                          type="button"
                          className={`product-art color-${i % 5}`}
                          aria-label={`Add ${p.name} to order bag`}
                          disabled={!p.stock || busy || loading || !!receipt}
                          onClick={() => add(p)}
                        >
                          {p.image_path ? (
                            <img src={`/api/products/${p.id}/image`} alt={p.name} />
                          ) : (
                            <span>{p.emoji}</span>
                          )}
                          <small
                            className={
                              p.stock === 0
                                ? 'pos-sold-out'
                                : p.stock < 5
                                  ? 'pos-low-stock'
                                  : 'pos-in-stock'
                            }
                          >
                            {p.stock ? `${p.stock} in stock` : 'Sold out'}
                          </small>
                        </button>
                        <div className="product-info">
                          <small>{p.category}</small>
                          <h3>{p.name}</h3>
                          <div>
                            <b>{money(p.price_cents)}</b>
                            {inBag ? (
                              <span className="pos-card-stepper">
                                <button
                                  type="button"
                                  disabled={busy || loading || !!receipt}
                                  aria-label={`Remove one ${p.name}`}
                                  onClick={() => quantity(p.id, -1)}
                                >
                                  <Minus size={13} />
                                </button>
                                <span>{inBag}</span>
                                <button
                                  type="button"
                                  disabled={busy || loading || !!receipt || inBag >= p.stock}
                                  aria-label={`Add one ${p.name}`}
                                  onClick={() => add(p)}
                                >
                                  <Plus size={13} />
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="add"
                                disabled={!p.stock || busy || loading || !!receipt}
                                onClick={() => add(p)}
                              >
                                <Plus size={14} />
                                Add
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {loading && <p className="empty">Loading your catalog…</p>}
                {!loading && !filtered.length && (
                  <p className="empty">No products found. Add products in Inventory.</p>
                )}
                <p className="catalog-footer">
                  <span className="online" /> Connected to your store inventory
                </p>
              </section>
            )}
            {tab === 'bag' && (
              <aside id="admin-order-bag" className="order">
                <div className="order-heading">
                  <div>
                    <h2>Order bag</h2>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        setTab('register');
                        onContinue?.();
                      }}
                    >
                      Continue shopping
                    </button>
                    <small>Review items and record payment</small>
                  </div>
                  <button
                    className="clear-order"
                    disabled={!cart.length || busy}
                    onClick={() => {
                      setCart([]);
                      setCashReceived('');
                      setError('');
                    }}
                  >
                    Cancel order
                  </button>
                  <span className="bag-count">{cart.reduce((s, i) => s + i.quantity, 0)}</span>
                </div>
                <div className="cart-items">
                  {!cart.length ? (
                    <div className="empty-cart">
                      <div>
                        <ShoppingBag size={30} />
                      </div>
                      <h3>Your bag is waiting</h3>
                      <p>
                        Add a product to get started.
                        <br />
                        We’ll take care of the totals.
                      </p>
                    </div>
                  ) : (
                    cart.map((i) => (
                      <div className="cart-item" key={i.product.id}>
                        <span className="cart-emoji">
                          {i.product.image_path ? (
                            <img src={`/api/products/${i.product.id}/image`} alt="" />
                          ) : (
                            i.product.emoji
                          )}
                        </span>
                        <div className="cart-item-info">
                          <b>{i.product.name}</b>
                          <small>{money(sizePrice(i.product, i.size))}</small>
                          {sizeOptions(i.product).length > 0 && (
                            <fieldset className="pos-size-picker">
                              <legend>Size</legend>
                              <div>
                                {sizeOptions(i.product).map((size) => (
                                  <button
                                    type="button"
                                    key={size}
                                    className={i.size === size ? 'selected' : ''}
                                    aria-pressed={i.size === size}
                                    disabled={busy}
                                    onClick={() => setItemSize(i.product.id, size)}
                                  >
                                    {size.charAt(0).toUpperCase() + size.slice(1)}
                                  </button>
                                ))}
                              </div>
                            </fieldset>
                          )}
                          <div className="stepper">
                            <button
                              disabled={busy}
                              aria-label={`Remove one ${i.product.name}`}
                              onClick={() => quantity(i.product.id, -1)}
                            >
                              <Minus size={12} />
                            </button>
                            <input
                              aria-label={`Quantity for ${i.product.name}`}
                              type="number"
                              min="1"
                              max={Math.max(1, i.product.stock)}
                              step="1"
                              value={i.quantity}
                              disabled={busy}
                              onChange={(e) => editQuantity(i.product.id, Number(e.target.value))}
                            />
                            <button
                              disabled={busy || i.quantity >= i.product.stock}
                              aria-label={`Add one ${i.product.name}`}
                              onClick={() => quantity(i.product.id, 1)}
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </div>
                        <div>
                          <b>{money(sizePrice(i.product, i.size) * i.quantity)}</b>
                          <button
                            disabled={busy}
                            className="remove"
                            aria-label={`Remove ${i.product.name}`}
                            onClick={() =>
                              setCart((c) => c.filter((x) => x.product.id !== i.product.id))
                            }
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="order-summary">
                  <div>
                    <span>Subtotal</span>
                    <span>{money(subtotal)}</span>
                  </div>
                  <div>
                    <span>Tax ({taxPercent}%)</span>
                    <span>{money(tax)}</span>
                  </div>
                  <label className="order-note">
                    Custom discount (%)
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={customDiscount}
                      disabled={busy}
                      placeholder="0"
                      onChange={(e) => setCustomDiscount(e.target.value)}
                    />
                    <small>Enter a percentage from 0 to 100.</small>
                  </label>
                  {!validDiscount && (
                    <p className="order-warning" role="alert">
                      Discount must be between 0% and 100%.
                    </p>
                  )}
                  {validDiscount && discount > 0 && (
                    <div>
                      <span>Custom discount</span>
                      <span>−{money(discount)}</span>
                    </div>
                  )}
                  <div className="total">
                    <b>Total</b>
                    <b>{money(total)}</b>
                  </div>
                  <fieldset className="service-choice">
                    <legend>Order type</legend>
                    <div>
                      <button
                        type="button"
                        disabled={busy}
                        className={serviceType === 'dine_in' ? 'selected' : ''}
                        aria-pressed={serviceType === 'dine_in'}
                        onClick={() => setServiceType('dine_in')}
                      >
                        Dine in
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className={serviceType === 'takeaway' ? 'selected' : ''}
                        aria-pressed={serviceType === 'takeaway'}
                        onClick={() => {
                          setServiceType('takeaway');
                          setTableId(null);
                        }}
                      >
                        Takeaway
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
                  <p className="payment-label">PAYMENT METHOD</p>
                  <div className="payments">
                    <button
                      disabled={busy}
                      className={payment === 'cash' ? 'selected' : ''}
                      onClick={() => setPayment('cash')}
                    >
                      <Banknote size={18} />
                      Cash
                    </button>
                    <button
                      disabled={busy}
                      className={payment === 'card' ? 'selected' : ''}
                      onClick={() => setPayment('card')}
                    >
                      <CreditCard size={18} />
                      Card
                    </button>
                  </div>
                  {payment === 'cash' && (
                    <section className="cash-details">
                      <label>
                        Cash received (MMK)
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder={(total / 100).toFixed(2)}
                          value={cashReceived}
                          disabled={busy}
                          onChange={(e) => setCashReceived(e.target.value)}
                        />
                      </label>
                      {validCash ? (
                        <p>
                          Change <b>{money(received - total)}</b>
                        </p>
                      ) : (
                        <p role="alert">Enter enough cash to cover the total.</p>
                      )}
                    </section>
                  )}
                  {invalidStock && (
                    <p className="order-warning" role="alert">
                      Stock changed. Edit quantities or remove unavailable items.
                    </p>
                  )}
                  <button
                    className="checkout"
                    disabled={
                      !cart.length ||
                      busy ||
                      loading ||
                      !validDiscount ||
                      !validTable ||
                      !validContact ||
                      invalidStock ||
                      (payment === 'cash' && !validCash)
                    }
                    onClick={openPayment}
                  >
                    {busy ? 'Processing…' : 'Payment'}
                    <span>{money(total)} →</span>
                  </button>
                  <p className="checkout-note">Card records an external terminal payment.</p>
                </div>
              </aside>
            )}
          </div>
        ) : tab === 'inventory' ? (
          <section className="panel inventory-panel">
            <div className="inventory-create-heading">
              <div>
                <span className="eyebrow">PRODUCT CATALOG</span>
                <h2>Add a product</h2>
                <p>
                  Create a complete product record. The SKU is generated automatically and can be
                  replaced before saving.
                </p>
              </div>
              <span className="inventory-create-icon">
                <Package size={24} />
              </span>
            </div>
            <form className="product-form inventory-create-form" onSubmit={createProduct}>
              {[
                ['name', 'Product name', 'text'],
                ['sku', 'SKU / barcode', 'text'],
                ['small_price', 'Small price (MMK)', 'number'],
                ['medium_price', 'Medium price (MMK)', 'number'],
                ['large_price', 'Large price (MMK)', 'number'],
                ['stock', 'Stock quantity', 'number'],
              ].map(([name, label, type]) => (
                <label key={name}>
                  {label}
                  <input
                    name={name}
                    type={type}
                    defaultValue={name === 'sku' ? productSku() : undefined}
                    required={!name.includes('price')}
                    min={type === 'number' ? 0 : undefined}
                    step={name.includes('price') ? '.01' : type === 'number' ? '1' : undefined}
                  />
                </label>
              ))}
              <p className="muted size-price-help">
                Enter at least one size price. Leave a price blank to hide that size.
              </p>
              <label className="inventory-category-field">
                Category
                <input
                  name="category"
                  type="text"
                  list="pos-category-options"
                  placeholder="Choose or type a new category"
                  maxLength={60}
                  required
                />
                <datalist id="pos-category-options">
                  {productCategories.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
                <small>Select an existing category or type a custom category name.</small>
              </label>
              <label className="inventory-image-field">
                Product image
                <input name="image" type="file" accept="image/jpeg,image/png,image/webp" />
                <small>JPG, PNG or WebP · up to 2 MB</small>
              </label>
              <div className="inventory-form-actions">
                <button className="primary" disabled={busy}>
                  {busy ? 'Saving…' : 'Add product'}
                </button>
                <button type="reset" className="secondary" disabled={busy}>
                  Clear form
                </button>
              </div>
            </form>
            <div className="inventory-list-heading">
              <div>
                <span className="eyebrow">INVENTORY CONTROL</span>
                <h2>Stock overview</h2>
              </div>
              <p className="inventory-help">
                Edit product to change its name, price, stock, image, or category. SKU stays fixed
                after creation.
              </p>
            </div>
            {stockNotice && (
              <p className="success" role="status">
                {stockNotice}
              </p>
            )}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Category</th>
                    <th>Size prices</th>
                    <th>Available</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryItems.map((p) => (
                    <tr key={p.id}>
                      <td>
                        {p.emoji} {p.name}
                      </td>
                      <td>{p.sku}</td>
                      <td>{p.category}</td>
                      <td>
                        <span className="product-size-prices">
                          {p.small_price_cents !== null && (
                            <span>S {money(p.small_price_cents)}</span>
                          )}
                          {p.medium_price_cents !== null && (
                            <span>M {money(p.medium_price_cents)}</span>
                          )}
                          {p.large_price_cents !== null && (
                            <span>L {money(p.large_price_cents)}</span>
                          )}
                        </span>
                      </td>
                      <td>
                        <span className={p.stock < 5 ? 'low' : 'stock'}>{p.stock} units</span>
                      </td>
                      <td>
                        <span
                          className={`inventory-status ${p.active ? 'is-active' : 'is-inactive'}`}
                        >
                          {p.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="inventory-actions">
                          <button
                            type="button"
                            className="secondary inventory-edit"
                            disabled={busy}
                            onClick={() => {
                              setEditProduct(p);
                              setStockError('');
                            }}
                          >
                            Edit product
                          </button>
                          <button
                            type="button"
                            className={p.active ? 'inventory-deactivate' : 'inventory-activate'}
                            disabled={busy}
                            onClick={() => void toggleInventoryStatus(p)}
                          >
                            {p.active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            className="inventory-delete"
                            disabled={busy}
                            onClick={() => {
                              setDeleteProduct(p);
                              setStockError('');
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {inventory.length > 0 && (
              <nav className="order-pagination" aria-label="Inventory pages">
                <span>
                  Showing {(currentInventoryPage - 1) * 10 + 1}–
                  {Math.min(currentInventoryPage * 10, inventory.length)} of {inventory.length}{' '}
                  products
                </span>
                <button
                  disabled={currentInventoryPage === 1}
                  onClick={() => setInventoryPage(currentInventoryPage - 1)}
                >
                  Previous
                </button>
                {Array.from({ length: inventoryPages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    className={currentInventoryPage === n ? 'selected' : ''}
                    aria-current={currentInventoryPage === n ? 'page' : undefined}
                    onClick={() => setInventoryPage(n)}
                  >
                    {n}
                  </button>
                ))}
                <button
                  disabled={currentInventoryPage === inventoryPages}
                  onClick={() => setInventoryPage(currentInventoryPage + 1)}
                >
                  Next
                </button>
              </nav>
            )}
          </section>
        ) : (
          <section className="panel">
            <div className="sales-stats">
              <div>
                <small>Total sales</small>
                <h2>{money(sales.reduce((s, x) => s + x.total_cents, 0))}</h2>
              </div>
              <div>
                <small>Transactions</small>
                <h2>{sales.length}</h2>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Receipt</th>
                    <th>Date</th>
                    <th>Payment</th>
                    <th>Total</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pageSales.map((s) => (
                    <tr key={s.id}>
                      <td>#{String(s.id).padStart(5, '0')}</td>
                      <td>{new Date(s.created_at).toLocaleString()}</td>
                      <td>{s.payment_method}</td>
                      <td>{money(s.total_cents)}</td>
                      <td>
                        <button onClick={() => setReceipt(s)}>View receipt</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sales.length > 0 && (
              <nav className="order-pagination" aria-label="Sales history pages">
                <span>
                  Showing {(currentSalesPage - 1) * 10 + 1}–
                  {Math.min(currentSalesPage * 10, sales.length)} of {sales.length} sales
                </span>
                <button
                  disabled={currentSalesPage === 1}
                  onClick={() => setSalesPage(currentSalesPage - 1)}
                >
                  Previous
                </button>
                {Array.from({ length: salesPages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    className={currentSalesPage === n ? 'selected' : ''}
                    aria-current={currentSalesPage === n ? 'page' : undefined}
                    onClick={() => setSalesPage(n)}
                  >
                    {n}
                  </button>
                ))}
                <button
                  disabled={currentSalesPage === salesPages}
                  onClick={() => setSalesPage(currentSalesPage + 1)}
                >
                  Next
                </button>
              </nav>
            )}
            {!sales.length && <p className="empty">Your first sale starts here.</p>}
          </section>
        )}
        <footer>
          KIPI POS / A GOOD DAY IN STORE<span>Made for everyday business.</span>
        </footer>
      </main>
      <dialog
        ref={productEditor}
        className="payment-dialog"
        aria-labelledby="inventory-edit-title"
        onCancel={(e) => {
          e.preventDefault();
          if (!busy) setEditProduct(null);
        }}
      >
        <form key={editProduct?.id} onSubmit={saveInventoryProduct}>
          <h2 id="inventory-edit-title">Edit product</h2>
          <div className="inventory-edit-fields">
            <label>
              SKU (fixed)
              <input value={editProduct?.sku || ''} readOnly />
            </label>
            {[
              ['name', 'Product name', editProduct?.name || '', 'text'],
              ['category', 'Category', editProduct?.category || '', 'text'],
              ['small_price', 'Small price (MMK)', sizePriceInput(editProduct, 'small'), 'number'],
              [
                'medium_price',
                'Medium price (MMK)',
                sizePriceInput(editProduct, 'medium'),
                'number',
              ],
              ['large_price', 'Large price (MMK)', sizePriceInput(editProduct, 'large'), 'number'],
              ['stock', 'Available stock', editProduct?.stock || 0, 'number'],
              ['emoji', 'Product icon', editProduct?.emoji || '📦', 'text'],
            ].map(([name, label, value, type]) => (
              <label key={String(name)}>
                {label}
                <input
                  name={String(name)}
                  type={String(type)}
                  defaultValue={value}
                  list={name === 'category' ? 'pos-category-options' : undefined}
                  required={!String(name).includes('price')}
                  disabled={busy}
                  min={type === 'number' ? 0 : undefined}
                  step={
                    String(name).includes('price') ? '0.01' : type === 'number' ? '1' : undefined
                  }
                  maxLength={name === 'category' ? 60 : name === 'emoji' ? 10 : 100}
                />
                {name === 'category' && (
                  <small>Choose an existing category or type a custom one.</small>
                )}
              </label>
            ))}
            <p className="muted size-price-help">
              Enter at least one size price. Leave a price blank to hide that size.
            </p>
            <label>
              Replace image (optional)
              <input
                name="image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
              />
            </label>
            <label className="card-confirmation">
              <input
                name="active"
                type="checkbox"
                defaultChecked={!!editProduct?.active}
                disabled={busy}
              />
              Active product
            </label>
          </div>
          {stockError && (
            <p className="error" role="alert">
              {stockError}
            </p>
          )}
          <div className="receipt-actions">
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => setEditProduct(null)}
            >
              Cancel
            </button>
            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save product'}
            </button>
          </div>
        </form>
      </dialog>
      <dialog
        ref={deleteDialog}
        className="payment-dialog"
        aria-labelledby="delete-product-title"
        onCancel={(e) => {
          e.preventDefault();
          if (!busy) setDeleteProduct(null);
        }}
      >
        <h2 id="delete-product-title">Delete product?</h2>
        <p>
          Delete {deleteProduct?.name} from inventory? Products with transaction history or linked
          promotions cannot be deleted.
        </p>
        {stockError && (
          <p className="error" role="alert">
            {stockError}
          </p>
        )}
        <div className="receipt-actions">
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => setDeleteProduct(null)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="inventory-delete"
            disabled={busy}
            onClick={() => void removeProduct()}
          >
            {busy ? 'Deleting…' : 'Delete product'}
          </button>
        </div>
      </dialog>
      <dialog
        ref={paymentDialog}
        className="payment-dialog"
        onCancel={(e) => {
          e.preventDefault();
          cancelPayment();
        }}
        aria-labelledby="payment-title"
      >
        <span className="eyebrow">REVIEW YOUR SALE</span>
        <h2 id="payment-title">Complete payment</h2>
        <p>
          {cart.reduce((sum, item) => sum + item.quantity, 0)} items ·{' '}
          {payment === 'cash' ? 'Cash payment' : 'Card payment'}
        </p>
        <div className="receipt-line">
          <span>Subtotal</span>
          <b>{money(subtotal)}</b>
        </div>
        {discount > 0 && validDiscount && (
          <div className="receipt-line">
            <span>Custom discount</span>
            <b>−{money(discount)}</b>
          </div>
        )}
        <div className="receipt-line total">
          <b>Total</b>
          <b>{money(total)}</b>
        </div>
        {payment === 'cash' ? (
          <>
            <div className="receipt-line">
              <span>Cash received</span>
              <b>{money(received)}</b>
            </div>
            <div className="receipt-line">
              <span>Change to return</span>
              <b>{money(received - total)}</b>
            </div>
          </>
        ) : (
          <>
            <label className="order-note">
              Cardholder name (optional)
              <input
                value={cardName}
                maxLength={100}
                disabled={busy}
                onChange={(e) => setCardName(e.target.value)}
              />
            </label>
            <label className="order-note">
              Last 4 digits (optional)
              <input
                value={cardLastFour}
                inputMode="numeric"
                maxLength={4}
                pattern="[0-9]{4}"
                disabled={busy}
                onChange={(e) => setCardLastFour(e.target.value.replace(/[^0-9]/g, ''))}
              />
            </label>
            <label className="card-confirmation">
              <input
                type="checkbox"
                checked={cardConfirmed}
                disabled={busy}
                onChange={(e) => setCardConfirmed(e.target.checked)}
              />
              Payment was approved on the card terminal.
            </label>
          </>
        )}
        <p>Cancel returns to your order without taking payment.</p>
        <div className="receipt-actions">
          <button className="cancel-payment" disabled={busy} onClick={cancelPayment} autoFocus>
            Cancel
          </button>
          <button
            className="primary"
            disabled={
              busy ||
              !validDiscount ||
              invalidStock ||
              (payment === 'cash' && !validCash) ||
              (payment === 'card' &&
                (!cardConfirmed || !!(cardLastFour && cardLastFour.length !== 4)))
            }
            onClick={checkout}
          >
            {busy ? 'Processing…' : 'Complete payment'}
          </button>
        </div>
      </dialog>
      {receipt &&
        createPortal(
          <div className="modal-backdrop pos-receipt-modal">
            <section
              ref={receiptPanel}
              tabIndex={-1}
              className="receipt"
              role="dialog"
              aria-modal="true"
              aria-label="Sale receipt"
            >
              <span className="bill-paid-badge">PAID</span>
              <h2>Kipi POS</h2>
              <p>Receipt #{String(receipt.id).padStart(5, '0')}</p>
              <small>
                {new Date(
                  receipt.created_at.includes('T')
                    ? receipt.created_at
                    : receipt.created_at.replace(' ', 'T') + 'Z',
                ).toLocaleString('en-GB', { timeZone: 'Asia/Yangon' })}{' '}
                · Myanmar time
              </small>
              <p>
                {receipt.service_type === 'dine_in'
                  ? `Dine in · ${receipt.table_name || 'Table not specified'}`
                  : 'Takeaway'}
              </p>
              {receipt.service_type === 'takeaway' && receipt.contact_name && (
                <div className="order-contact-summary">
                  <p>
                    {receipt.contact_name} · {receipt.contact_email}
                  </p>
                  <p>{receipt.phone}</p>
                  <p>
                    {receipt.location} · {receipt.zip_code}
                  </p>
                </div>
              )}
              {receipt.items.map((i, n) => (
                <div className="receipt-line" key={n}>
                  <span>
                    {i.quantity} × {i.name} ·{' '}
                    {(i.size || 'medium').charAt(0).toUpperCase() + (i.size || 'medium').slice(1)}
                  </span>
                  <b>{money(i.quantity * i.price_cents)}</b>
                </div>
              ))}
              {receipt.discount_cents > 0 && (
                <div className="receipt-line">
                  <span>
                    {receipt.promotion_code
                      ? `Discount (${receipt.promotion_code})`
                      : 'Custom discount'}
                  </span>
                  <b>−{money(receipt.discount_cents)}</b>
                </div>
              )}
              <div className="receipt-line tax-line">
                <span>Tax ({Number(receipt.tax_percent)}%)</span>
                <b>{money(receipt.tax_cents)}</b>
              </div>
              <div className="receipt-line total">
                <b>Total</b>
                <b>{money(receipt.total_cents)}</b>
              </div>
              {receipt.payment_method === 'cash' && receipt.amount_received_cents !== null && (
                <>
                  <div className="receipt-line">
                    <span>Cash received</span>
                    <b>{money(receipt.amount_received_cents)}</b>
                  </div>
                  <div className="receipt-line">
                    <span>Change</span>
                    <b>{money(receipt.change_cents)}</b>
                  </div>
                </>
              )}
              <p>Paid by {receipt.payment_method}.</p>
              {receipt.payment_method === 'card' && (
                <p>
                  {receipt.cardholder_name}
                  {receipt.card_last_four ? ` · Card ending ${receipt.card_last_four}` : ''}
                </p>
              )}
              <div className="bill-thank-you">
                <strong>Thank you! Come again.</strong>
                <p>We appreciate your visit.</p>
              </div>
              <div className="receipt-actions">
                <button onClick={() => window.print()}>
                  <Printer size={16} />
                  Print receipt
                </button>
                <button className="primary" onClick={() => setReceipt(null)}>
                  Done
                </button>
              </div>
            </section>
          </div>,
          document.body,
        )}
    </div>
  );
}
