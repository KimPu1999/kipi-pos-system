import BrandLogo from './BrandLogo';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  ShoppingBag,
  Package,
  Users,
  BarChart3,
  Search,
  Plus,
  Trash2,
  Banknote,
  HelpCircle,
  ShieldCheck,
  NotebookIcon,
  Menu,
  X,
  Heart,
} from './icons';
import { api, type User } from './api';
import App from './App';
import ThemeToggle from './ThemeToggle';
import { productSku } from './productSku';
import CustomerShop, { type ProductSize } from './CustomerShop';
import Reports from './Reports';
import Purchases from './Purchases';
import CashBook from './CashBook';
import Notebook from './Notebook';
import InfoPage from './InfoPage';
import { FacebookIcon, InstagramIcon, TikTokIcon } from './SocialIcons';
import Employees from './Employees';
import Billing from './Billing';
import Settings from './Settings';
import CustomerSettings from './CustomerSettings';
import { applySettings, type Settings as SettingsData } from './systemSettings';
import DiningTables from './DiningTables';
import CustomerRewards from './CustomerRewards';
import AdminCustomers from './AdminCustomers';
import Tax from './Tax';
import OrderNotifications from './OrderNotifications';
import CustomerAnnouncements from './CustomerAnnouncements';
import Promotions, { type Promotion } from './Promotions';
import OrderContactFields, { type OrderContact } from './OrderContactFields';
import CustomerDashboard from './CustomerDashboard';
import DashboardView from './Dashboard';
import Wishlist from './Wishlist';
type WishlistNotice = {
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
type Order = {
  id: number;
  user_id: number;
  transfer_provider: 'kbzpay' | 'ayapay' | null;
  payment_choice: 'cash' | 'card' | 'transfer';
  transfer_name: string | null;
  transfer_phone: string | null;
  table_name: string | null;
  dining_table_id: number | null;
  updated_at: string;
  driver_name: string | null;
  driver_phone: string | null;
  delivery_location: string | null;
  delivery_eta: string | null;
  delivery_status: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  subtotal_cents: number | null;
  discount_cents: number;
  tax_percent: number;
  tax_cents: number;
  promotion_code: string | null;
  service_type: 'dine_in' | 'takeaway';
  contact_name: string | null;
  contact_email: string | null;
  phone: string | null;
  location: string | null;
  zip_code: string | null;
  customer_confirmed_at: string | null;
  confirmed_at: string | null;
  ready_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  status: string;
  sale_id: number | null;
  payment: {
    payment_method: string;
    amount_received_cents: number | null;
    change_cents: number;
  } | null;
  total_cents: number;
  customer_name: string;
  customer_email: string;
  note: string | null;
  created_at: string;
  items: {
    product_id: number;
    name: string;
    quantity: number;
    price_cents: number;
    size: ProductSize;
  }[];
};
type Dashboard = {
  revenue_cents: number;
  sales_count: number;
  pending_orders: number;
  customers: number;
  low_stock: Product[];
  people: (User & { created_at: string })[];
};
const money = (c: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'MMK',
    currencyDisplay: 'code',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(c / 100);
const productSizeOptions = (product: Product): ProductSize[] => {
  const options: ProductSize[] = [];
  if ((product.small_price_cents ?? 0) > 0) options.push('small');
  if ((product.medium_price_cents ?? 0) > 0) options.push('medium');
  if ((product.large_price_cents ?? 0) > 0) options.push('large');
  return options;
};
const defaultProductSize = (product: Product): ProductSize => {
  const options = productSizeOptions(product);
  return options.includes('medium') ? 'medium' : options[0] || 'medium';
};
const selectedProductSize = (product: Product, size?: ProductSize): ProductSize =>
  size && productSizeOptions(product).includes(size) ? size : defaultProductSize(product);
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
export default function Portal({ user, logout }: { user: User; logout: ReactNode }) {
  const portalRef = useRef<HTMLDivElement>(null);
  const portalHeaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const portal = portalRef.current;
    const header = portalHeaderRef.current;
    if (!portal || !header) return;

    const updateHeaderHeight = () => {
      portal.style.setProperty('--portal-header-height', `${Math.ceil(header.offsetHeight)}px`);
    };

    updateHeaderHeight();
    const observer = new ResizeObserver(updateHeaderHeight);
    observer.observe(header);
    window.addEventListener('orientationchange', updateHeaderHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener('orientationchange', updateHeaderHeight);
    };
  }, []);
  const admin = user.role === 'admin';
  useEffect(() => {
    document.documentElement.dataset.portalRole = admin ? 'admin' : 'customer';
    const refresh = () => {
      void api<SettingsData>('/settings')
        .then(applySettings)
        .catch(() => {});
    };
    refresh();
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => {
      window.removeEventListener('focus', refresh);
      window.clearInterval(timer);
      delete document.documentElement.dataset.portalRole;
    };
  }, [admin]);
  const [storeName, setStoreName] = useState('Kipi POS');
  const [taxPercent, setTaxPercent] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(
    () => window.matchMedia('(min-width:1025px)').matches,
  );
  useEffect(() => {
    void api<SettingsData>('/settings')
      .then((s) => {
        setStoreName(s.store_name);
        setTaxPercent(s.tax_percent);
      })
      .catch(() => {});
    const update = (event: Event) =>
      setStoreName((event as CustomEvent<SettingsData>).detail.store_name);
    window.addEventListener('store-settings', update);
    return () => window.removeEventListener('store-settings', update);
  }, []);
  const [notificationUnread, setNotificationUnread] = useState(0);
  const [bagRequest, setBagRequest] = useState(0);
  const [adminBagCount, setAdminBagCount] = useState(0);

  const allowedPages = admin
    ? [
        'dashboard',
        'pos',
        'pos-inventory',
        'pos-sales',
        'pos-wishlist',
        'bag',
        'tables',
        'products',
        'purchases',
        'cashbook',
        'tax',
        'notebook',
        'billing',
        'orders',
        'customers',
        'employees',
        'promotions',
        'reports',
        'settings',
        'faq',
        'privacy',
      ]
    : [
        'home',
        'shop',
        'bag',
        'wishlist',
        'orders',
        'rewards',
        'account',
        'settings',
        'faq',
        'privacy',
      ];
  const initialPage = () => {
    const page = location.hash.slice(1);
    return allowedPages.includes(page) ? page : admin ? 'dashboard' : 'home';
  };
  const [tab, setActiveTab] = useState(initialPage),
    [products, setProducts] = useState<Product[]>([]),
    [orders, setOrders] = useState<Order[]>([]),
    [wishlist, setWishlist] = useState<number[]>([]),
    [wishlistNotices, setWishlistNotices] = useState<WishlistNotice[]>([]),
    [wishlistUnread, setWishlistUnread] = useState(0),
    [dashboard, setDashboard] = useState<Dashboard | null>(null),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('All'),
    [cart, setCart] = useState<Record<number, number>>({}),
    [sizes, setSizes] = useState<Record<number, ProductSize>>({}),
    [note, setNote] = useState(''),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [editing, setEditing] = useState<Product | null>(null),
    [showForm, setShowForm] = useState(false),
    [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const deleteProductDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (deletingProduct) deleteProductDialog.current?.showModal();
    else deleteProductDialog.current?.close();
  }, [deletingProduct]);
  const [navigationDepth, setNavigationDepth] = useState(0);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('.portal > .portal-content')?.scrollTo({ top: 0 });
      document.querySelector<HTMLElement>('.portal > .app.pos-app > main')?.scrollTo({ top: 0 });
      window.scrollTo({ top: 0 });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [tab]);

  function setTab(next: string) {
    if (next === tab) return;
    const depth = (history.state?.kipiUser === user.id ? history.state.kipiDepth : 0) + 1;
    history.pushState(
      { ...history.state, kipiUser: user.id, kipiTab: next, kipiDepth: depth },
      '',
      `#${next}`,
    );
    setNavigationDepth(depth);
    setActiveTab(next);
  }
  useEffect(() => {
    const initial = initialPage();
    const depth =
      history.state?.kipiUser === user.id && history.state.kipiTab === initial
        ? history.state.kipiDepth || 0
        : 0;
    history.replaceState(
      { ...history.state, kipiUser: user.id, kipiTab: initial, kipiDepth: depth },
      '',
      `#${initial}`,
    );
    setActiveTab(initial);
    setNavigationDepth(depth);
    const allowed = admin
      ? [
          'dashboard',
          'pos',
          'pos-inventory',
          'pos-sales',
          'bag',
          'tables',
          'products',
          'purchases',
          'cashbook',
          'tax',
          'notebook',
          'billing',
          'orders',
          'customers',
          'employees',
          'promotions',
          'reports',
          'settings',
          'faq',
          'privacy',
        ]
      : [
          'home',
          'shop',
          'bag',
          'wishlist',
          'orders',
          'rewards',
          'account',
          'settings',
          'faq',
          'privacy',
        ];
    const pop = (event: PopStateEvent) => {
      if (event.state?.kipiUser !== user.id || !allowed.includes(event.state.kipiTab)) return;
      setActiveTab(event.state.kipiTab);
      setNavigationDepth(event.state.kipiDepth || 0);
      setSidebarOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (
        event.key !== 'Backspace' ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.defaultPrevented
      )
        return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]',
        ) ||
        document.querySelector('dialog[open]')
      )
        return;
      if (history.state?.kipiUser === user.id && history.state.kipiDepth > 0) {
        event.preventDefault();
        history.back();
      }
    };
    window.addEventListener('popstate', pop);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('popstate', pop);
      window.removeEventListener('keydown', key);
    };
  }, [admin, user.id]);
  useEffect(() => {
    document.querySelector('.portal-content')?.scrollTo({ top: 0 });
  }, [tab]);

  useEffect(() => {
    if (!bagRequest || tab !== 'bag') return;
    const frame = requestAnimationFrame(() => {
      const bag = document.getElementById('customer-order-bag');
      bag?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      bag?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [bagRequest, tab]);
  const working = useRef(false);
  const [deliveryOrder, setDeliveryOrder] = useState<Order | null>(null);
  const deliveryDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (deliveryOrder) deliveryDialog.current?.showModal();
    else deliveryDialog.current?.close();
  }, [deliveryOrder]);
  async function saveDelivery(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!deliveryOrder) return;
    const data = new FormData(e.currentTarget);
    const body = Object.fromEntries(data.entries());
    body.delivery_eta = new Date(String(body.delivery_eta)).toISOString();
    await action(
      async () => {
        const updated = await api<Order>(`/orders/${deliveryOrder.id}/delivery`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        setDeliveryOrder(null);
        if (body.delivery_status === 'delivered') openPayment(updated);
      },
      body.delivery_status === 'delivered'
        ? 'Delivery confirmed. Record payment to complete the order.'
        : 'Delivery details updated. The customer can see them in My orders.',
    );
  }
  async function markDeliveredAndPay(order: Order) {
    if (
      !order.driver_name ||
      !order.driver_phone ||
      !order.delivery_location ||
      !order.delivery_eta
    )
      return;
    await action(async () => {
      const updated = await api<Order>(`/orders/${order.id}/delivery`, {
        method: 'PATCH',
        body: JSON.stringify({
          driver_name: order.driver_name,
          driver_phone: order.driver_phone,
          delivery_location: order.delivery_location,
          delivery_eta: order.delivery_eta,
          delivery_status: 'delivered',
        }),
      });
      openPayment(updated);
    }, 'Delivery confirmed. Record payment, then print the receipt.');
  }
  function localTime(value: string | null) {
    if (!value) return '';
    const d = new Date(value);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [promotionCode, setPromotionCode] = useState('');
  const [editPromotion, setEditPromotion] = useState('');
  const [tables, setTables] = useState<
      {
        id: number;
        name: string;
        seats: number;
        area: string;
        status: 'available' | 'occupied' | 'reserved';
      }[]
    >([]),
    [tableId, setTableId] = useState<number | null>(null);
  useEffect(() => {
    void api<
      {
        id: number;
        name: string;
        seats: number;
        area: string;
        status: 'available' | 'occupied' | 'reserved';
      }[]
    >('/table-choices')
      .then(setTables)
      .catch(() => {});
  }, [tab, orders]);
  const [paymentChoice, setPaymentChoice] = useState<'cash' | 'card' | 'transfer'>('cash'),
    [orderPaymentMethod, setOrderPaymentMethod] = useState<'cash' | 'card' | 'bank_transfer'>(
      'cash',
    ),
    [orderCardConfirmed, setOrderCardConfirmed] = useState(false),
    [cardName, setCardName] = useState(''),
    [cardLastFour, setCardLastFour] = useState('');
  const [transferProvider, setTransferProvider] = useState<'kbzpay' | 'ayapay'>('kbzpay');
  const [transferName, setTransferName] = useState(user.name),
    [transferPhone, setTransferPhone] = useState(''),
    [transferVerified, setTransferVerified] = useState(false);
  const [serviceType, setServiceType] = useState<'dine_in' | 'takeaway'>('takeaway');
  const [editPaymentChoice, setEditPaymentChoice] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [editServiceType, setEditServiceType] = useState<'dine_in' | 'takeaway'>('takeaway');
  const [contact, setContact] = useState<OrderContact>({
    name: user.name,
    email: user.email,
    phone: '',
    location: '',
    zip_code: '',
  });
  const [editContact, setEditContact] = useState<OrderContact>(contact);
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  function waited(date: string) {
    const minutes = Math.max(0, Math.floor((clock - new Date(date).getTime()) / 60000));
    return minutes < 1
      ? 'Just now'
      : minutes < 60
        ? `${minutes} min`
        : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  }

  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [editItems, setEditItems] = useState<
    { product_id: number; quantity: number; size: ProductSize }[]
  >([]);
  const [editNote, setEditNote] = useState('');
  const orderEditor = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (editOrder) orderEditor.current?.showModal();
    else orderEditor.current?.close();
  }, [editOrder]);
  function openOrderEdit(o: Order) {
    setError('');
    setEditOrder(o);
    setEditItems(
      o.items.map((i) => ({
        product_id: i.product_id,
        quantity: i.quantity,
        size: i.size || 'medium',
      })),
    );
    setEditNote(o.note || '');
    setEditPromotion(o.promotion_code || '');
    setEditServiceType(o.service_type);
    setEditPaymentChoice(o.payment_choice);
    setTransferProvider(o.transfer_provider || 'kbzpay');
    setTransferName(o.transfer_name || 'Thawng Kim Piang');
    setTransferPhone(o.transfer_phone || '09428981899');
    setEditContact({
      name: o.customer_name,
      email: o.customer_email,
      phone: o.phone || '',
      location: o.location || '',
      zip_code: o.zip_code || '',
    });
  }
  async function saveOrderEdit() {
    if (!editOrder || !editItems.length) return;
    await action(async () => {
      await api(`/orders/${editOrder.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          transfer_provider: editPaymentChoice === 'transfer' ? transferProvider : null,
          transfer_name: editPaymentChoice === 'transfer' ? 'Thawng Kim Piang' : null,
          transfer_phone: editPaymentChoice === 'transfer' ? '09428981899' : null,
          payment_choice: editPaymentChoice,
          items: editItems,
          promotion_code: editPromotion || null,
          service_type: editServiceType,
          note: editNote,
          ...(editServiceType === 'takeaway' ? { contact: editContact } : {}),
        }),
      });
      setEditOrder(null);
    }, 'Order changes saved. Please confirm your updated order.');
  }

  const editForm = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (showForm) {
      editForm.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      editForm.current?.querySelector<HTMLInputElement>('input[name=name]')?.focus();
    }
  }, [showForm, editing]);
  const loadVersion = useRef(0);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [orderFilter, setOrderFilter] = useState('All');
  const [orderSearch, setOrderSearch] = useState('');
  const dayKey = (value: string | Date) => {
    const date = value instanceof Date ? value : new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  const monthKey = (value: string | Date) => dayKey(value).slice(0, 7);
  const yearKey = (value: string | Date) => dayKey(value).slice(0, 4);
  const weekKey = (value: string | Date) => {
    const date = value instanceof Date ? value : new Date(value);
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    return dayKey(date);
  };
  type OrderRange = 'all' | 'day' | 'week' | 'month' | 'year';
  const [orderRange, setOrderRange] = useState<OrderRange>('day');
  const [orderAnchor, setOrderAnchor] = useState<Date>(() => new Date());
  const inOrderPeriod = (createdAt: string | Date) =>
    orderRange === 'all'
      ? true
      : orderRange === 'day'
        ? dayKey(createdAt) === dayKey(orderAnchor)
        : orderRange === 'week'
          ? weekKey(createdAt) === weekKey(orderAnchor)
          : orderRange === 'month'
            ? monthKey(createdAt) === monthKey(orderAnchor)
            : yearKey(createdAt) === yearKey(orderAnchor);
  const shiftOrderPeriod = (amount: number) =>
    setOrderAnchor((current) => {
      const date = new Date(current);
      if (orderRange === 'week') date.setDate(date.getDate() + amount * 7);
      else if (orderRange === 'month') date.setMonth(date.getMonth() + amount);
      else if (orderRange === 'year') date.setFullYear(date.getFullYear() + amount);
      else date.setDate(date.getDate() + amount);
      return date;
    });
  const focusOrderPeriod = (range: OrderRange) => {
    setOrderRange(range);
    setOrderAnchor(new Date());
  };
  const [orderPage, setOrderPage] = useState(1);
  useEffect(() => setOrderPage(1), [orderFilter, orderSearch, orderRange, orderAnchor, tab]);
  const [productPage, setProductPage] = useState(1);
  useEffect(() => setProductPage(1), [search, tab]);
  const [payingOrder, setPayingOrder] = useState<Order | null>(null);
  const [cash, setCash] = useState(''),
    [orderDiscount, setOrderDiscount] = useState(''),
    [availablePoints, setAvailablePoints] = useState(0),
    [usePoints, setUsePoints] = useState(false),
    [paidReceiptId, setPaidReceiptId] = useState<number | null>(null);
  const orderDiscountPercent = orderDiscount.trim() === '' ? 0 : Number(orderDiscount);
  const orderDiscountValid =
    Number.isFinite(orderDiscountPercent) &&
    orderDiscountPercent >= 0 &&
    orderDiscountPercent <= 100;
  const orderPreTax = Math.max(0, (payingOrder?.total_cents || 0) - (payingOrder?.tax_cents || 0));
  const customOrderDiscount = orderDiscountValid
    ? Math.round((orderPreTax * orderDiscountPercent) / 100)
    : 0;
  const paymentTax = Math.round(
    ((orderPreTax - customOrderDiscount) * Number(payingOrder?.tax_percent || 0)) / 100,
  );
  const beforePointTotal = orderPreTax - customOrderDiscount + paymentTax;
  const pointDiscount = usePoints ? Math.min(beforePointTotal, availablePoints * 100) : 0;
  const pointsToUse = pointDiscount ? Math.ceil(pointDiscount / 100) : 0;
  const orderPayTotal = beforePointTotal - pointDiscount;
  const payDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (payingOrder) payDialog.current?.showModal();
    else payDialog.current?.close();
  }, [payingOrder]);
  const amount = cash.trim() === '' ? orderPayTotal : Math.round(Number(cash) * 100);
  const cashValid =
    Number.isFinite(amount) &&
    orderDiscountValid &&
    amount >= orderPayTotal &&
    amount <= 1000000000;
  const dateOrders = orders.filter((o) => inOrderPeriod(o.created_at));
  const visibleOrders = dateOrders.filter(
    (o) =>
      (orderFilter === 'All' || o.status === orderFilter) &&
      (!admin ||
        `${o.id} ${o.customer_name} ${o.customer_email}`
          .toLowerCase()
          .includes(orderSearch.trim().toLowerCase())),
  );
  const orderPages = Math.max(1, Math.ceil(visibleOrders.length / 10));
  const currentOrderPage = Math.min(orderPage, orderPages);
  const pageOrders = visibleOrders.slice((currentOrderPage - 1) * 10, currentOrderPage * 10);
  const orderWeekLabel = () => {
    const date = new Date(orderAnchor);
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    const start = new Date(date);
    date.setDate(date.getDate() + 6);
    const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `${fmt(start)} – ${fmt(date)}, ${date.getFullYear()}`;
  };
  const orderPeriodLabel =
    orderRange === 'all'
      ? 'All order dates'
      : orderRange === 'day'
        ? new Date(orderAnchor).toLocaleDateString(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : orderRange === 'week'
          ? orderWeekLabel()
          : orderRange === 'month'
            ? new Date(orderAnchor).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
              })
            : String(new Date(orderAnchor).getFullYear());
  const adminProductItems = products.filter((p) =>
    `${p.name} ${p.sku}`.toLowerCase().includes(search.toLowerCase()),
  );
  const productPages = Math.max(1, Math.ceil(adminProductItems.length / 10)),
    currentProductPage = Math.min(productPage, productPages),
    pageProducts = adminProductItems.slice((currentProductPage - 1) * 10, currentProductPage * 10);

  async function load() {
    const version = ++loadVersion.current;
    const [p, o, d, promo, wl, wn] = await Promise.all([
      api<Product[]>(admin ? '/products' : '/catalog'),
      api<Order[]>('/orders'),
      admin ? api<Dashboard>('/admin/dashboard') : Promise.resolve(null),
      api<Promotion[]>('/promotions'),
      api<number[]>('/wishlist'),
      api<{ unread: number; notifications: WishlistNotice[] }>('/wishlist/notifications'),
    ]);
    if (version !== loadVersion.current) return;
    setProducts(p);
    setOrders(o);
    setDashboard(d);
    setPromotions(promo);
    setWishlist(wl);
    setWishlistNotices(wn.notifications);
    setWishlistUnread(wn.unread);
    setLastSynced(new Date());
  }
  useEffect(() => {
    if (tab === 'pos') return;
    let current = true;
    setLoading(true);
    void load()
      .catch((e) => {
        if (current) setError(e.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [tab]);
  async function action(task: () => Promise<unknown>, message: string) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await task();
      setNotice(message);
      try {
        await load();
      } catch {
        setError('Saved successfully, but refresh failed. Please refresh before continuing.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
      try {
        await load();
      } catch {
        /* Keep the error and allow a manual refresh. */
      }
    } finally {
      setBusy(false);
      working.current = false;
    }
  }
  useEffect(() => {
    const refreshOrders = () => {
      if (working.current || document.visibilityState !== 'visible') return;
      void load().catch(() =>
        setError('Orders could not update. Check your connection and press Refresh.'),
      );
    };
    const timer = window.setInterval(refreshOrders, 10000);
    window.addEventListener('focus', refreshOrders);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshOrders);
    };
  }, [tab]);
  const cartItems = products.filter((p) => cart[p.id]);
  const total = cartItems.reduce((sum, p) => sum + p.price_cents * cart[p.id], 0);
  const unavailable = Object.keys(cart).some((id) => {
    const p = products.find((p) => p.id === Number(id));
    return !p || !p.active || cart[Number(id)] > p.stock;
  });
  async function toggleWishlist(id: number) {
    setWishlist((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
    try {
      await api(wishlist.includes(id) ? `/wishlist/${id}` : `/wishlist/${id}`, {
        method: wishlist.includes(id) ? 'DELETE' : 'POST',
      });
    } catch (e) {
      setWishlist((current) =>
        current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
      );
      setError(e instanceof Error ? e.message : 'Could not update your wishlist.');
    }
  }
  useEffect(() => {
    if (tab !== 'wishlist' || !wishlistUnread) return;
    void (async () => {
      setWishlistUnread(0);
      setWishlistNotices((n) => n.map((x) => ({ ...x, read_at: new Date().toISOString() })));
      try {
        await api('/wishlist/notifications/read', { method: 'POST' });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not clear wishlist notifications.');
      }
    })();
  }, [tab]);
  function changeWishlistItem(id: number, delta: number) {
    const product = products.find((p) => p.id === id);
    if (!product?.active) return;
    setCart((current) => {
      const next = { ...current };
      const quantity = (current[id] || 0) + delta;
      if (quantity <= 0) delete next[id];
      else if (quantity <= product.stock) next[id] = quantity;
      return next;
    });
    if (delta > 0) setSizes((current) => (current[id] ? current : { ...current, [id]: 'medium' }));
    else if ((cart[id] || 0) + delta <= 0) {
      setSizes((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }
  }
  async function place() {
    if (
      loading ||
      working.current ||
      !cartItems.length ||
      unavailable ||
      (serviceType === 'dine_in' && !tableId)
    )
      return;
    await action(
      async () => {
        await api('/orders', {
          method: 'POST',
          body: JSON.stringify({
            transfer_provider: paymentChoice === 'transfer' ? transferProvider : null,
            transfer_name: paymentChoice === 'transfer' ? 'Thawng Kim Piang' : null,
            transfer_phone: paymentChoice === 'transfer' ? '09428981899' : null,
            payment_choice: paymentChoice,
            dining_table_id: serviceType === 'dine_in' ? tableId : null,
            promotion_code: promotionCode || null,
            service_type: serviceType,
            note,
            ...(serviceType === 'takeaway' ? { contact } : {}),
            items: Object.entries(cart).map(([id, quantity]) => ({
              product_id: Number(id),
              quantity,
              size: selectedProductSize(
                products.find((product) => product.id === Number(id))!,
                sizes[Number(id)],
              ),
            })),
          }),
        });
        setCart({});
        setSizes({});
        setNote('');
        setPromotionCode('');
        setPaymentChoice('cash');
        setOrderFilter('All');
        setOrderSearch('');
        setTab('orders');
      },
      paymentChoice === 'transfer'
        ? 'Order placed. Staff will verify your online payment.'
        : 'Order placed successfully.',
    );
  }
  async function saveProduct(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
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
    d.set('active', d.get('active') === 'on' ? '1' : '0');
    const file = d.get('image');
    if (file instanceof File && !file.size) d.delete('image');
    if (editing) d.set('_method', 'PUT');
    await action(async () => {
      await api(editing ? `/products/${editing.id}` : '/products', { method: 'POST', body: d });
      setShowForm(false);
      setEditing(null);
    }, 'Product saved.');
  }
  async function deleteProduct() {
    if (!deletingProduct) return;
    const product = deletingProduct;
    await action(async () => {
      await api(`/products/${product.id}/permanent`, { method: 'DELETE' });
      setCart((current) => {
        const next = { ...current };
        delete next[product.id];
        return next;
      });
      setSizes((current) => {
        const next = { ...current };
        delete next[product.id];
        return next;
      });
      if (editing?.id === product.id) {
        setShowForm(false);
        setEditing(null);
      }
      setDeletingProduct(null);
    }, `${product.name} deleted.`);
  }
  function openPayment(o: Order) {
    setCash('');
    setOrderDiscount('');
    setAvailablePoints(0);
    setUsePoints(false);
    void api<{ points: number }>(`/customer/rewards?customer_id=${o.user_id}`)
      .then((data) => setAvailablePoints(data.points))
      .catch(() => setAvailablePoints(0));
    setOrderPaymentMethod(
      o.payment_choice === 'transfer' ? 'bank_transfer' : o.payment_choice || 'cash',
    );
    setTransferVerified(false);
    setOrderCardConfirmed(false);
    setCardName('');
    setCardLastFour('');
    setPayingOrder(o);
  }
  async function status(o: Order, next: string) {
    if (next === 'completed') {
      openPayment(o);
      return;
    }
    if (
      next === 'cancelled' &&
      !window.confirm(`Cancel order #${o.id}? Reserved stock will be restored.`)
    )
      return;
    await action(
      async () => {
        await api(`/orders/${o.id}`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
        if (next === 'cancelled') {
          setOrderFilter('cancelled');
          setOrderSearch('');
        }
      },
      next === 'cancelled' ? 'Order cancelled. You can find it in Cancelled.' : 'Order updated.',
    );
  }
  async function completeOrder() {
    if (
      !payingOrder ||
      !orderDiscountValid ||
      (orderPaymentMethod === 'cash'
        ? !cashValid
        : orderPaymentMethod === 'bank_transfer'
          ? !transferVerified
          : !orderCardConfirmed || !!(cardLastFour && cardLastFour.length !== 4))
    )
      return;
    await action(async () => {
      const paid = await api<Order>(`/orders/${payingOrder.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'completed',
          cardholder_name: orderPaymentMethod === 'card' ? cardName || null : null,
          card_last_four: orderPaymentMethod === 'card' ? cardLastFour || null : null,
          transfer_confirmed: transferVerified,
          payment_method: orderPaymentMethod,
          card_confirmed: orderCardConfirmed,
          amount_received_cents: orderPaymentMethod === 'cash' ? amount : null,
          custom_discount_percent: orderDiscountPercent,
          use_points: usePoints,
        }),
      });
      setPaidReceiptId(paid.sale_id);
      setPayingOrder(null);
    }, 'Payment recorded and order completed.');
  }
  const nav = admin
    ? [
        ['dashboard', 'Overview', BarChart3],
        ['pos', 'Point of sale', ShoppingBag],
        ['bag', 'Order bag', ShoppingBag],
        ['tables', 'Dine tables', Users],
        ['products', 'Products', Package],
        ['purchases', 'Purchases', Package],
        ['cashbook', 'Cash in / out', Banknote],
        ['tax', 'Tax', Banknote],
        ['notebook', 'Notebook', NotebookIcon],
        ['billing', 'Billing', ShoppingBag],
        ['orders', 'Orders', ShoppingBag],
        ['customers', 'Customers', Users],
        ['employees', 'Employees', Users],
        ['promotions', 'Promotions', Package],
        ['reports', 'Reports', BarChart3],
        ['settings', 'Settings', Package],
        ['faq', 'FAQ', HelpCircle],
        ['privacy', 'Privacy', ShieldCheck],
      ]
    : [
        ['home', 'Dashboard', BarChart3],
        ['shop', 'Shop', ShoppingBag],
        ['bag', 'Order bag', ShoppingBag],
        ['wishlist', 'Wishlist', Heart],
        ['orders', 'My orders', Package],
        ['rewards', 'Points & purchases', ShoppingBag],
        ['account', 'My account', Users],
        ['settings', 'Settings', Package],
        ['faq', 'FAQ', HelpCircle],
        ['privacy', 'Privacy', ShieldCheck],
      ];
  return (
    <div
      ref={portalRef}
      className={`portal ${admin ? 'admin-portal' : 'customer-portal'} ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}
    >
      <div ref={portalHeaderRef} className="portal-top">
        <div className="brand sidebar-logo-toggle header-brand-logo">
          <BrandLogo showPos={false} />
        </div>
        <div className="header-contact" aria-label="Store contact">
          <a href="mailto:kipipos710@gmail.com">
            <span>Email</span>
            <strong>kipipos710@gmail.com</strong>
          </a>
          <a href="tel:09428981899">
            <span>Phone</span>
            <strong>09428981899</strong>
          </a>
        </div>
        <div className="portal-user">
          <button
            type="button"
            className="header-menu-toggle"
            aria-controls="portal-sidebar"
            aria-expanded={sidebarOpen}
            aria-label={sidebarOpen ? 'Close sidebar menu' : 'Open sidebar menu'}
            title={sidebarOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setSidebarOpen((open) => !open)}
          >
            <Menu size={21} />
          </button>
          <button
            type="button"
            className="header-back"
            aria-label="Go to previous page"
            title="Previous page (Backspace)"
            disabled={navigationDepth === 0}
            onClick={() => history.back()}
          >
            ←<span>Back</span>
          </button>
          {
            <button
              type="button"
              className="header-order-bag"
              aria-label={`Open order bag, ${admin ? adminBagCount : Object.values(cart).reduce((sum, n) => sum + n, 0)} items`}
              aria-controls={admin ? 'admin-order-bag' : 'customer-order-bag'}
              onClick={() => {
                setTab('bag');
                setBagRequest((n) => n + 1);
              }}
            >
              <ShoppingBag size={20} />
              <span className="header-bag-label">Order bag</span>
              <span className="header-bag-count">
                {admin ? adminBagCount : Object.values(cart).reduce((sum, n) => sum + n, 0)}
              </span>
            </button>
          }
          <ThemeToggle key={admin ? 'admin' : 'customer'} role={admin ? 'admin' : 'customer'} />
          {admin ? (
            <OrderNotifications
              key={user.id}
              orders={orders}
              userId={user.id}
              admin
              loaded={!!lastSynced}
              onUnread={setNotificationUnread}
              onOrder={(id) => {
                setTab('orders');
                setOrderFilter('All');
                setOrderSearch(String(id));
                setError('');
              }}
            />
          ) : (
            <CustomerAnnouncements key={user.id} onUnread={setNotificationUnread} />
          )}
        </div>
      </div>
      {sidebarOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Close sidebar menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <nav id="portal-sidebar" className="portal-nav" aria-label="Main menu">
        <div className="sidebar-drawer-header">
          <BrandLogo showPos={false} />
          <button
            type="button"
            className="sidebar-drawer-close"
            aria-label="Close sidebar menu"
            title="Close menu"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={22} />
          </button>
        </div>
        <div className="portal-nav-items">
          {nav.map(([key, label, Icon]) => (
            <button
              key={String(key)}
              title={String(label)}
              aria-label={String(label)}
              data-label={String(label)}
              className={tab === key ? 'active' : ''}
              onClick={() => {
                setTab(String(key));
                if (window.matchMedia('(max-width:1024px)').matches) setSidebarOpen(false);
                setFilter('All');
                setOrderFilter('All');
                setOrderSearch('');
                setSearch('');
                setError('');
                setNotice('');
              }}
            >
              {typeof Icon !== 'string' && <Icon size={17} />}
              <span>{String(label)}</span>
              {admin && key === 'orders' && notificationUnread > 0 && (
                <span
                  className="sidebar-notification-count"
                  aria-label={`${notificationUnread} unread order notifications`}
                >
                  {notificationUnread}
                </span>
              )}
              {key === 'wishlist' && wishlistUnread > 0 && (
                <span
                  className="sidebar-notification-count"
                  aria-label={`${wishlistUnread} unread wishlist notifications`}
                >
                  {wishlistUnread}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="portal-sidebar-account">
          <div className="sidebar-account-avatar">{user.name.slice(0, 2).toUpperCase()}</div>
          <div className="sidebar-account-info">
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </div>
          {logout}
        </div>
      </nav>
      {admin && (
        <App
          user={user}
          logout={logout}
          visible={tab.startsWith('pos') || tab === 'bag'}
          bagPage={tab === 'bag'}
          page={
            tab === 'pos-inventory'
              ? 'inventory'
              : tab === 'pos-sales'
                ? 'sales'
                : tab === 'pos-wishlist'
                  ? 'wishlist'
                  : 'register'
          }
          onNavigate={(page) => setTab(page === 'register' ? 'pos' : `pos-${page}`)}
          onCartCount={setAdminBagCount}
          onContinue={() => setTab('pos')}
          onOpenBag={() => setTab('bag')}
        />
      )}{' '}
      {!(admin && (tab.startsWith('pos') || tab === 'bag')) && (
        <div className="portal-content">
          <div className="portal-heading">
            <div>
              <span className="eyebrow">
                {admin ? 'A CLEAR VIEW OF YOUR BUSINESS' : 'THE EVERYDAY STORE'}
              </span>
            </div>
            <button
              className="secondary"
              disabled={busy || loading}
              onClick={() => {
                setLoading(true);
                load()
                  .then(() => setError(''))
                  .catch((e) => setError(e.message))
                  .finally(() => setLoading(false));
              }}
            >
              Refresh
            </button>
          </div>
          {error && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
          {notice && (
            <div role="status" className="success">
              {notice}
            </div>
          )}
          {loading && <p role="status">Loading your workspace…</p>}
          {tab === 'dashboard' && dashboard && (
            <DashboardView
              data={dashboard}
              orders={orders}
              products={products}
              name={user.name}
              navigate={(next) => {
                setOrderFilter('All');
                setOrderSearch('');
                setFilter('All');
                setSearch('');
                setTab(next);
              }}
            />
          )}
          {tab === 'products' && (
            <section className="panel products-panel">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">YOUR STORE COLLECTION</span>
                  <h2>Catalog & inventory</h2>
                  <p className="products-description">
                    Organize products, set prices, and keep your shelves ready.
                  </p>
                </div>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => {
                    setEditing(null);
                    setShowForm(true);
                  }}
                >
                  + Add product
                </button>
              </div>
              <div className="product-summary">
                <div>
                  <span className="summary-dot summary-all" />
                  <span>All products</span>
                  <b>{products.length}</b>
                </div>
                <div>
                  <span className="summary-dot summary-active" />
                  <span>Active</span>
                  <b>{products.filter((p) => p.active).length}</b>
                </div>
                <div>
                  <span className="summary-dot summary-inactive" />
                  <span>Inactive</span>
                  <b>{products.filter((p) => !p.active).length}</b>
                </div>
                <div>
                  <span className="summary-dot summary-low" />
                  <span>Low stock</span>
                  <b>{products.filter((p) => p.active && p.stock < 5).length}</b>
                </div>
              </div>
              {showForm && (
                <form
                  ref={editForm}
                  key={editing?.id || 'new'}
                  className="product-form"
                  onSubmit={saveProduct}
                >
                  <div className="product-edit-heading">
                    <h2>{editing ? `Edit ${editing.name}` : 'New product'}</h2>
                    <p>Save your changes to update the catalog.</p>
                  </div>
                  {[
                    ['name', 'Name', editing?.name || '', 'text'],
                    ['sku', 'SKU', editing?.sku || productSku(), 'text'],
                    ['category', 'Category', editing?.category || '', 'text'],
                    [
                      'small_price',
                      'Small price (MMK)',
                      sizePriceInput(editing, 'small'),
                      'number',
                    ],
                    [
                      'medium_price',
                      'Medium price (MMK)',
                      sizePriceInput(editing, 'medium'),
                      'number',
                    ],
                    [
                      'large_price',
                      'Large price (MMK)',
                      sizePriceInput(editing, 'large'),
                      'number',
                    ],
                    ['stock', 'Available stock', editing?.stock ?? 0, 'number'],
                    ['emoji', 'Product emoji', editing?.emoji || '📦', 'text'],
                  ].map(([name, label, value, type]) => (
                    <label key={String(name)}>
                      {label}
                      <input
                        name={String(name)}
                        type={String(type)}
                        defaultValue={value}
                        readOnly={name === 'sku' && !!editing}
                        required={!String(name).includes('price')}
                        min={type === 'number' ? 0 : undefined}
                        step={
                          String(name).includes('price')
                            ? '.01'
                            : type === 'number'
                              ? '1'
                              : undefined
                        }
                      />
                    </label>
                  ))}
                  <p className="muted size-price-help">
                    Enter at least one size price. Leave a price blank to hide that size from the
                    shop.
                  </p>
                  <label className="image-upload">
                    Product image
                    <input
                      name="image"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={busy}
                    />
                    <small>JPG, PNG or WebP · Up to 2 MB</small>
                    {editing?.image_path && (
                      <img
                        className="image-preview"
                        src={`/api/products/${editing.id}/image`}
                        alt={editing.name}
                      />
                    )}
                  </label>
                  <label className="product-active-field">
                    <span>Product status</span>
                    <span>
                      <input
                        type="checkbox"
                        name="active"
                        defaultChecked={editing ? !!editing.active : true}
                        disabled={busy}
                      />{' '}
                      Active — available in the shop and POS
                    </span>
                  </label>
                  <button className="primary" disabled={busy}>
                    {busy ? 'Saving…' : 'Save product'}
                  </button>
                  <button type="button" disabled={busy} onClick={() => setShowForm(false)}>
                    Cancel
                  </button>
                </form>
              )}
              <label className="search">
                <Search size={18} />
                <input
                  placeholder="Search name or SKU"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Size prices</th>
                      <th>Available</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageProducts.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <div className="product-table-name">
                            {p.image_path ? (
                              <img
                                className="product-thumb"
                                src={`/api/products/${p.id}/image`}
                                alt=""
                              />
                            ) : (
                              <span className="product-table-emoji">{p.emoji}</span>
                            )}
                            <span>
                              <b>{p.name}</b>
                              <small>{p.category}</small>
                            </span>
                          </div>
                        </td>
                        <td>{p.sku}</td>
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
                          <span
                            className={
                              p.stock < 5 ? 'inventory-quantity is-low' : 'inventory-quantity'
                            }
                          >
                            {p.stock} units
                          </span>
                        </td>
                        <td>
                          <span
                            className={`product-state ${p.active ? 'is-active' : 'is-inactive'}`}
                          >
                            {p.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="product-table-actions">
                          <button
                            className="edit-product-button"
                            disabled={busy}
                            onClick={() => {
                              setEditing(p);
                              setShowForm(true);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className={
                              p.active ? 'deactivate-product-button' : 'activate-product-button'
                            }
                            disabled={busy}
                            onClick={() =>
                              void action(
                                async () => {
                                  const updated = await api<Product>(`/products/${p.id}/active`, {
                                    method: 'PATCH',
                                    body: JSON.stringify({ active: !p.active }),
                                  });
                                  setProducts((current) =>
                                    current.map((item) => (item.id === p.id ? updated : item)),
                                  );
                                  if (editing?.id === p.id) {
                                    setShowForm(false);
                                    setEditing(null);
                                  }
                                },
                                p.active ? 'Product deactivated.' : 'Product activated.',
                              )
                            }
                          >
                            {p.active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            className="delete-product-button"
                            disabled={busy}
                            onClick={() => {
                              setError('');
                              setDeletingProduct(p);
                            }}
                          >
                            <Trash2 size={15} />
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {adminProductItems.length > 0 && (
                <nav className="order-pagination" aria-label="Product pages">
                  <span>
                    Showing {(currentProductPage - 1) * 10 + 1}–
                    {Math.min(currentProductPage * 10, adminProductItems.length)} of{' '}
                    {adminProductItems.length} products
                  </span>
                  <button
                    className="secondary"
                    disabled={currentProductPage === 1}
                    onClick={() => setProductPage(currentProductPage - 1)}
                  >
                    Previous
                  </button>
                  {Array.from({ length: productPages }, (_, i) => i + 1).map((number) => (
                    <button
                      key={number}
                      className={currentProductPage === number ? 'selected' : ''}
                      aria-current={currentProductPage === number ? 'page' : undefined}
                      onClick={() => setProductPage(number)}
                    >
                      {number}
                    </button>
                  ))}
                  <button
                    className="secondary"
                    disabled={currentProductPage === productPages}
                    onClick={() => setProductPage(currentProductPage + 1)}
                  >
                    Next
                  </button>
                </nav>
              )}
              {!adminProductItems.length && (
                <div className="dashboard-empty">
                  <Package size={28} />
                  <h3>No products found</h3>
                  <p>Try another search, or add your first product.</p>
                </div>
              )}
            </section>
          )}
          {tab === 'home' && !admin && (
            <CustomerDashboard
              cart={cart}
              busy={busy || loading}
              onAdd={(id) => {
                const product = products.find((p) => p.id === id);
                if (!product?.active || busy || loading) return;
                setCart((current) =>
                  (current[id] || 0) < product.stock
                    ? { ...current, [id]: (current[id] || 0) + 1 }
                    : current,
                );
              }}
              promotions={promotions}
              onPromotion={(code) => {
                setPromotionCode(code);
                setTab('shop');
              }}
              name={user.name}
              products={products}
              orders={orders}
              navigate={(next) => {
                setTab(next);
                setOrderFilter('All');
                setOrderSearch('');
                setFilter('All');
                setSearch('');
              }}
            />
          )}
          {tab === 'rewards' && !admin && <CustomerRewards />}
          {tab === 'wishlist' && !admin && (
            <Wishlist
              products={products}
              wishlist={wishlist}
              cart={cart}
              sizes={sizes}
              notices={wishlistNotices}
              onToggle={toggleWishlist}
              onAdd={changeWishlistItem}
              onBrowse={() => {
                setTab('shop');
                setFilter('All');
                setSearch('');
              }}
            />
          )}
          {tab === 'customers' && admin && dashboard && (
            <AdminCustomers people={dashboard.people} orders={orders} />
          )}
          {tab === 'tax' && admin && <Tax />}
          {tab === 'tables' && admin && <DiningTables />}
          {tab === 'settings' && (admin ? <Settings /> : <CustomerSettings />)}
          {tab === 'billing' && admin && <Billing />}
          {tab === 'employees' && admin && <Employees navigate={setTab} />}
          {tab === 'purchases' && admin && <Purchases />}
          {tab === 'cashbook' && admin && <CashBook />}
          {tab === 'notebook' && admin && <Notebook />}
          {tab === 'reports' && admin && <Reports />}
          {tab === 'promotions' && admin && <Promotions />}
          {(tab === 'faq' || tab === 'privacy') && <InfoPage page={tab} />}
          {!admin && (tab === 'shop' || tab === 'bag') && (
            <CustomerShop
              taxPercent={taxPercent}
              view={tab}
              onContinue={() => setTab('shop')}
              transferProvider={transferProvider}
              setTransferProvider={setTransferProvider}
              transferName={transferName}
              transferPhone={transferPhone}
              setTransferName={setTransferName}
              setTransferPhone={setTransferPhone}
              paymentChoice={paymentChoice}
              setPaymentChoice={setPaymentChoice}
              tables={tables}
              tableId={tableId}
              setTableId={setTableId}
              promotions={promotions}
              promotionCode={promotionCode}
              setPromotionCode={setPromotionCode}
              serviceType={serviceType}
              setServiceType={setServiceType}
              contact={contact}
              setContact={setContact}
              products={products}
              cart={cart}
              setCart={setCart}
              sizes={sizes}
              setSizes={setSizes}
              wishlist={wishlist}
              onToggleWishlist={toggleWishlist}
              search={search}
              setSearch={setSearch}
              category={filter}
              setCategory={setFilter}
              note={note}
              setNote={setNote}
              busy={busy}
              loading={loading}
              place={() => void place()}
            />
          )}
          {tab === 'orders' && (
            <section className="orders-workspace">
              <p className="order-sync" role="status">
                Updates every 10 seconds
                {lastSynced ? ` · Last updated ${lastSynced.toLocaleTimeString()}` : ''}
              </p>
              {admin && (
                <label className="search">
                  <Search size={18} />
                  <input
                    aria-label="Search orders"
                    placeholder={
                      admin ? 'Search order number or customer…' : 'Search your order number…'
                    }
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                  />
                </label>
              )}
              <div className="order-day-navigation" role="group" aria-label="Choose order period">
                <button
                  className="secondary"
                  onClick={() => shiftOrderPeriod(-1)}
                  disabled={orderRange === 'all'}
                >
                  ← Previous {orderRange === 'all' ? 'period' : orderRange}
                </button>
                <div>
                  <span>
                    {orderRange === 'all' ? 'Complete history' : `Orders for ${orderRange}`}
                  </span>
                  <strong>{orderPeriodLabel}</strong>
                  <small>
                    {dateOrders.length} {dateOrders.length === 1 ? 'order' : 'orders'}
                  </small>
                </div>
                <button
                  className="secondary"
                  onClick={() => shiftOrderPeriod(1)}
                  disabled={orderRange === 'all' || inOrderPeriod(new Date())}
                >
                  Next {orderRange === 'all' ? 'period' : orderRange} →
                </button>
                <button
                  className={
                    orderRange === 'day' && dayKey(orderAnchor) === dayKey(new Date())
                      ? 'primary'
                      : 'secondary'
                  }
                  onClick={() => focusOrderPeriod('day')}
                >
                  Today
                </button>
                <button
                  className={
                    orderRange === 'week' && weekKey(orderAnchor) === weekKey(new Date())
                      ? 'primary'
                      : 'secondary'
                  }
                  onClick={() => focusOrderPeriod('week')}
                >
                  This week
                </button>
                <button
                  className={
                    orderRange === 'month' && monthKey(orderAnchor) === monthKey(new Date())
                      ? 'primary'
                      : 'secondary'
                  }
                  onClick={() => focusOrderPeriod('month')}
                >
                  This month
                </button>
                <button
                  className={
                    orderRange === 'year' && yearKey(orderAnchor) === yearKey(new Date())
                      ? 'primary'
                      : 'secondary'
                  }
                  onClick={() => focusOrderPeriod('year')}
                >
                  This year
                </button>
                <button
                  className={orderRange === 'all' ? 'primary' : 'secondary'}
                  onClick={() => setOrderRange('all')}
                >
                  All dates
                </button>
              </div>
              <div className="order-filter-tabs" role="group" aria-label="Filter orders by status">
                {(admin
                  ? [
                      { key: 'All', label: 'All' },
                      { key: 'pending', label: 'Pending' },
                      { key: 'confirmed', label: 'Confirmed' },
                      { key: 'ready', label: 'Ready' },
                      { key: 'completed', label: 'Completed' },
                      { key: 'cancelled', label: 'Cancelled' },
                    ]
                  : [{ key: 'All', label: 'All' }]
                ).map((s) => (
                  <button
                    key={s.key}
                    aria-pressed={orderFilter === s.key}
                    className={orderFilter === s.key ? 'selected' : ''}
                    onClick={() => setOrderFilter(s.key)}
                  >
                    <span className={`filter-dot filter-${s.key}`} />
                    {s.label}
                    <span className="filter-count">
                      {s.key === 'All'
                        ? dateOrders.length
                        : dateOrders.filter((o) => o.status === s.key).length}
                    </span>
                  </button>
                ))}
              </div>
              <div className="orders-result-heading">
                <h2>
                  {orderFilter === 'All'
                    ? 'All orders'
                    : `${orderFilter.charAt(0).toUpperCase() + orderFilter.slice(1)} orders`}
                  {orderRange !== 'all' && <small> · {orderRange}</small>}
                </h2>
                <span>
                  {visibleOrders.length} {visibleOrders.length === 1 ? 'order' : 'orders'}
                </span>
              </div>
              <div className="order-list">
                {pageOrders.map((o) => (
                  <details
                    name={
                      ['pending', 'confirmed', 'ready'].includes(o.status)
                        ? undefined
                        : 'order-records'
                    }
                    open={['pending', 'confirmed', 'ready'].includes(o.status) ? true : undefined}
                    className={`panel order-status-card card-${o.status}`}
                    key={o.id}
                  >
                    <summary className="order-card-summary">
                      <div className="section-heading">
                        <h2>Order #{o.id}</h2>
                        <span className={`status ${o.status}`}>
                          {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                        </span>
                      </div>
                      <p className="muted">
                        {admin ? `${o.customer_name} · ${o.customer_email} · ` : ''}
                        {new Date(o.created_at).toLocaleString()}
                      </p>
                      <p className="order-status-description">
                        {
                          (
                            {
                              pending: 'Waiting for the store to confirm your order.',
                              confirmed: 'The store is preparing your order.',
                              ready: o.delivery_status
                                ? 'Your takeaway delivery details are shown below.'
                                : 'Your order is ready. Collect in store and pay cash.',
                              completed: 'Collected and paid. Thank you for your order.',
                              cancelled: 'This order was cancelled. No payment is due.',
                            } as Record<string, string>
                          )[o.status]
                        }
                      </p>
                      <span className="order-card-toggle" aria-hidden="true">
                        <span className="order-card-show-label">
                          {o.status === 'completed' ? 'View receipt & details' : 'View details'}
                        </span>
                        <span className="order-card-hide-label">Hide details</span>
                      </span>
                    </summary>
                    <div className="order-card-body">
                      <div className="order-time-details">
                        <div>
                          <span>Placed</span>
                          <time dateTime={o.created_at}>
                            {new Date(o.created_at).toLocaleString()}
                          </time>
                        </div>
                        {o.status === 'pending' && (
                          <div>
                            <span>Waiting time</span>
                            <b>{waited(o.created_at)}</b>
                          </div>
                        )}
                        {o.confirmed_at && (
                          <div>
                            <span>Store confirmed</span>
                            <time dateTime={o.confirmed_at}>
                              {new Date(o.confirmed_at).toLocaleString()}
                            </time>
                          </div>
                        )}
                        {o.ready_at && (
                          <div>
                            <span>Ready for pickup</span>
                            <time dateTime={o.ready_at}>
                              {new Date(o.ready_at).toLocaleString()}
                            </time>
                          </div>
                        )}
                        {o.status === 'ready' && o.ready_at && (
                          <div>
                            <span>Ready for</span>
                            <b>{waited(o.ready_at)}</b>
                          </div>
                        )}
                        {o.completed_at && (
                          <div>
                            <span>Completed</span>
                            <time dateTime={o.completed_at}>
                              {new Date(o.completed_at).toLocaleString()}
                            </time>
                          </div>
                        )}
                        {o.cancelled_at && (
                          <div>
                            <span>Cancelled</span>
                            <time dateTime={o.cancelled_at}>
                              {new Date(o.cancelled_at).toLocaleString()}
                            </time>
                          </div>
                        )}
                      </div>
                      {o.table_name && (
                        <p>
                          <strong>Dining table: {o.table_name}</strong>
                        </p>
                      )}
                      {o.items.map((i, n) => (
                        <div className="receipt-line" key={n}>
                          <span>
                            {i.quantity} × {i.name} ·{' '}
                            {(i.size || 'medium').charAt(0).toUpperCase() +
                              (i.size || 'medium').slice(1)}
                          </span>
                          <b>{money(i.price_cents * i.quantity)}</b>
                        </div>
                      ))}
                      <div className="order-service-badge">
                        {o.service_type === 'dine_in' ? '🍽️ Dine in' : '🛍️ Takeaway'}
                      </div>
                      {o.service_type === 'takeaway' && (
                        <div className="order-contact-summary">
                          <b>{o.customer_name}</b>
                          <span>{o.customer_email}</span>
                          {o.phone && <span>Phone: {o.phone}</span>}
                          {o.location && <span>Location: {o.location}</span>}
                          {o.zip_code && <span>ZIP: {o.zip_code}</span>}
                        </div>
                      )}
                      {o.note && <p className="order-note">Note: {o.note}</p>}
                      <>
                        {o.discount_cents > 0 && (
                          <div className="receipt-line">
                            <span>Discount ({o.promotion_code})</span>
                            <b>−{money(o.discount_cents)}</b>
                          </div>
                        )}
                      </>
                      <div className="receipt-line tax-line">
                        <span>Tax ({Number(o.tax_percent)}%)</span>
                        <b>{money(o.tax_cents)}</b>
                      </div>
                      <div className="receipt-line total">
                        <b>
                          {o.status === 'completed'
                            ? 'Paid in cash'
                            : o.status === 'cancelled'
                              ? 'Cancelled total'
                              : 'Total due at pickup'}
                        </b>
                        <b>{money(o.total_cents)}</b>
                      </div>
                      {o.payment && (
                        <>
                          <div className="receipt-line">
                            <span>Cash received</span>
                            <b>{money(o.payment.amount_received_cents ?? o.total_cents)}</b>
                          </div>
                          <div className="receipt-line">
                            <span>Change</span>
                            <b>{money(o.payment.change_cents)}</b>
                          </div>
                        </>
                      )}
                      <div
                        className={`takeaway-payment-record ${o.sale_id ? 'is-paid' : 'is-unpaid'}`}
                      >
                        <div>
                          <span>Payment status</span>
                          <strong>{o.sale_id ? 'Paid' : 'Unpaid'}</strong>
                        </div>
                        <div>
                          <span>Payment method</span>
                          <strong>
                            {o.payment_choice === 'transfer'
                              ? o.transfer_provider === 'ayapay'
                                ? 'AYA Pay'
                                : 'KBZPay'
                              : o.payment_choice === 'card'
                                ? 'Card'
                                : 'Cash'}
                          </strong>
                        </div>
                        {o.sale_id && (
                          <div>
                            <span>Receipt</span>
                            <strong>#{String(o.sale_id).padStart(5, '0')}</strong>
                          </div>
                        )}
                      </div>
                      {o.payment_choice === 'transfer' && (
                        <div className="order-contact-summary">
                          <strong>
                            {o.transfer_provider === 'ayapay' ? 'AYA Pay' : 'KBZPay'} account
                          </strong>
                          <p>
                            {o.transfer_name} · {o.transfer_phone}
                          </p>
                        </div>
                      )}
                      {o.customer_confirmed_at && (
                        <p className="customer-order-confirmed">✓ Customer confirmed this order</p>
                      )}
                      {!admin && (
                        <section className="order-payment-info">
                          <h3>Payment details</h3>
                          {!o.customer_confirmed_at && o.status === 'pending' ? (
                            <p>Confirm your order first to continue with payment details.</p>
                          ) : (
                            <>
                              <div className="receipt-line">
                                <span>Amount</span>
                                <b>{money(o.total_cents)}</b>
                              </div>
                              <p>
                                {o.sale_id
                                  ? `Paid · ${o.payment?.payment_method || 'cash'}`
                                  : `Unpaid · ${o.payment_choice === 'card' ? 'Card on store terminal' : o.payment_choice === 'transfer' ? `${o.transfer_provider === 'ayapay' ? 'AYA Pay' : 'KBZPay'} — awaiting verification` : 'Cash in store'}`}
                              </p>
                              {!o.sale_id && (
                                <p className="muted">Online payment is not connected yet.</p>
                              )}
                            </>
                          )}
                        </section>
                      )}
                      {o.delivery_status && (
                        <section className="delivery-details">
                          <h3>Takeaway delivery</h3>
                          <span className="status">{o.delivery_status.replaceAll('_', ' ')}</span>
                          <p>
                            <b>Driver:</b> {o.driver_name}
                          </p>
                          <p>
                            <b>Driver phone:</b>{' '}
                            <a href={`tel:${o.driver_phone}`}>{o.driver_phone}</a>
                          </p>
                          <p>
                            <b>Deliver to:</b> {o.customer_name}{' '}
                            {o.phone && (
                              <>
                                · <a href={`tel:${o.phone}`}>{o.phone}</a>
                              </>
                            )}
                          </p>
                          <p>
                            <b>Location:</b> {o.delivery_location}
                          </p>
                          {o.delivery_eta && (
                            <p>
                              <b>Estimated arrival:</b> {new Date(o.delivery_eta).toLocaleString()}
                            </p>
                          )}
                          {o.dispatched_at && (
                            <p>
                              <b>Dispatched:</b> {new Date(o.dispatched_at).toLocaleString()}
                            </p>
                          )}
                          {o.delivered_at && (
                            <p>
                              <b>Delivered:</b> {new Date(o.delivered_at).toLocaleString()}
                            </p>
                          )}
                        </section>
                      )}
                      <div className="order-actions">
                        {admin &&
                          o.status === 'ready' &&
                          o.service_type === 'takeaway' &&
                          (!o.delivery_status || o.delivery_status === 'assigned') && (
                            <button
                              className="secondary"
                              disabled={busy}
                              onClick={() => {
                                setDeliveryOrder(o);
                                setError('');
                              }}
                            >
                              {o.delivery_status === 'assigned'
                                ? 'Start delivery'
                                : 'Assign delivery'}
                            </button>
                          )}
                        {admin &&
                          o.status === 'ready' &&
                          o.service_type === 'takeaway' &&
                          o.delivery_status === 'out_for_delivery' && (
                            <button
                              className="primary delivery-pay-action"
                              disabled={busy}
                              onClick={() => void markDeliveredAndPay(o)}
                            >
                              Mark delivered &amp; take payment
                            </button>
                          )}
                        {!admin && o.status === 'pending' && !o.customer_confirmed_at && (
                          <>
                            <button
                              className="secondary"
                              disabled={busy}
                              onClick={() => openOrderEdit(o)}
                            >
                              Edit order
                            </button>
                            <button
                              className="primary"
                              disabled={busy}
                              onClick={() =>
                                void action(
                                  () => api(`/orders/${o.id}/confirm`, { method: 'POST' }),
                                  'Your order is confirmed. Waiting for the store to accept it.',
                                )
                              }
                            >
                              Confirm my order
                            </button>
                          </>
                        )}
                        {admin &&
                          o.status === 'pending' &&
                          (o.service_type !== 'takeaway' || o.customer_confirmed_at ? (
                            <button
                              className="primary"
                              disabled={busy}
                              onClick={() => void status(o, 'confirmed')}
                            >
                              Confirm order
                            </button>
                          ) : (
                            <span className="order-action-help">
                              Waiting for customer confirmation
                            </span>
                          ))}
                        {admin && o.status === 'confirmed' && (
                          <button
                            className="primary"
                            disabled={busy}
                            onClick={() => void status(o, 'ready')}
                          >
                            Ready for pickup
                          </button>
                        )}
                        {admin &&
                          o.status === 'ready' &&
                          (o.service_type === 'dine_in' || o.delivery_status === 'delivered') && (
                            <button
                              className="primary"
                              disabled={busy}
                              onClick={() => void status(o, 'completed')}
                            >
                              {o.service_type === 'takeaway'
                                ? 'Record takeaway payment'
                                : 'Record payment & complete'}
                            </button>
                          )}
                        {admin && o.status === 'completed' && o.sale_id && (
                          <button
                            className="secondary"
                            disabled={busy}
                            onClick={() => setPaidReceiptId(o.sale_id)}
                          >
                            View & print receipt
                          </button>
                        )}
                        {admin &&
                          o.status === 'ready' &&
                          o.service_type === 'takeaway' &&
                          !o.delivery_status && (
                            <span className="order-action-help">
                              Assign delivery details before payment.
                            </span>
                          )}
                        {admin &&
                          o.status === 'ready' &&
                          o.service_type === 'takeaway' &&
                          o.delivery_status === 'assigned' && (
                            <span className="order-action-help">
                              Start delivery before taking payment.
                            </span>
                          )}
                        {admin && ['pending', 'confirmed', 'ready'].includes(o.status) && (
                          <button
                            className="secondary cancel-order-action"
                            disabled={busy}
                            onClick={() => void status(o, 'cancelled')}
                          >
                            Cancel order
                          </button>
                        )}
                      </div>
                    </div>
                  </details>
                ))}
              </div>
              {visibleOrders.length > 0 && (
                <nav className="order-pagination" aria-label="Order pages">
                  <span>
                    Showing {(currentOrderPage - 1) * 10 + 1}–
                    {Math.min(currentOrderPage * 10, visibleOrders.length)} of{' '}
                    {visibleOrders.length}
                  </span>
                  <button
                    className="secondary"
                    disabled={currentOrderPage === 1}
                    onClick={() => setOrderPage(currentOrderPage - 1)}
                  >
                    Previous
                  </button>
                  {Array.from({ length: orderPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      className={currentOrderPage === page ? 'selected' : ''}
                      aria-current={currentOrderPage === page ? 'page' : undefined}
                      onClick={() => setOrderPage(page)}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    className="secondary"
                    disabled={currentOrderPage === orderPages}
                    onClick={() => setOrderPage(currentOrderPage + 1)}
                  >
                    Next
                  </button>
                </nav>
              )}
              {!visibleOrders.length && (
                <p className="empty">
                  {orders.length
                    ? 'No orders match this search or status. Try All or clear your search.'
                    : 'No pickup orders yet. Orders placed in the customer shop appear here.'}
                </p>
              )}
            </section>
          )}
          {tab === 'account' && (
            <section className="panel account-panel">
              <div className="avatar">{user.name.slice(0, 2).toUpperCase()}</div>
              <h2>{user.name}</h2>
              <p>{user.email}</p>
              <span className="status">Customer account</span>
              <p>Your orders and pickup status are available in My orders.</p>
              {logout}
            </section>
          )}
        </div>
      )}
      <dialog
        ref={deleteProductDialog}
        className="payment-dialog product-delete-dialog"
        aria-labelledby="delete-product-title"
        onCancel={(event) => {
          event.preventDefault();
          if (!busy) setDeletingProduct(null);
        }}
      >
        <h2 id="delete-product-title">Delete product?</h2>
        <p>
          Permanently delete <strong>{deletingProduct?.name}</strong>? This cannot be undone.
          Products used in orders, sales, purchases, or promotions must be deactivated instead.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="receipt-actions">
          <button type="button" disabled={busy} onClick={() => setDeletingProduct(null)}>
            Cancel
          </button>
          <button
            type="button"
            className="delete-product-confirm"
            disabled={busy}
            onClick={() => void deleteProduct()}
          >
            {busy ? 'Deleting…' : 'Delete product'}
          </button>
        </div>
      </dialog>
      <dialog
        ref={deliveryDialog}
        className="payment-dialog"
        aria-labelledby="delivery-title"
        onCancel={(e) => {
          e.preventDefault();
          if (!busy) setDeliveryOrder(null);
        }}
      >
        <form key={deliveryOrder?.id} onSubmit={saveDelivery}>
          <h2 id="delivery-title">Delivery · Order #{deliveryOrder?.id}</h2>
          <p>
            Enter driver details and estimated arrival. Times use your browser’s local timezone.
          </p>
          {deliveryOrder?.phone && (
            <div className="delivery-customer-message">
              <span>
                Customer phone: <strong>{deliveryOrder.phone}</strong>
              </span>
              <a
                className="secondary"
                href={`sms:${deliveryOrder.phone}?body=${encodeURIComponent(`Kipi POS order #${deliveryOrder.id}: Your delivery is coming. Open My orders for the driver and estimated arrival details.`)}`}
              >
                Message customer
              </a>
            </div>
          )}
          {[
            {
              name: 'driver_name',
              label: 'Driver name',
              value: deliveryOrder?.driver_name || '',
              type: 'text',
              max: 100,
            },
            {
              name: 'driver_phone',
              label: 'Driver phone',
              value: deliveryOrder?.driver_phone || '',
              type: 'tel',
              max: 40,
            },
            {
              name: 'delivery_location',
              label: 'Delivery address / location',
              value: deliveryOrder?.delivery_location || deliveryOrder?.location || '',
              type: 'text',
              max: 500,
            },
            {
              name: 'delivery_eta',
              label: 'Estimated delivery time',
              value: localTime(deliveryOrder?.delivery_eta || null),
              type: 'datetime-local',
              max: undefined,
            },
          ].map((f) => (
            <label className="order-note" key={f.name}>
              {f.label}
              <input
                name={f.name}
                type={f.type}
                required
                defaultValue={f.value}
                maxLength={f.max}
                disabled={busy}
              />
            </label>
          ))}
          <label className="order-note">
            Delivery status
            <select
              name="delivery_status"
              required
              defaultValue={deliveryOrder?.delivery_status || 'assigned'}
              disabled={busy}
            >
              {(!deliveryOrder?.delivery_status ||
                deliveryOrder.delivery_status === 'assigned') && (
                <option value="assigned">Assigned</option>
              )}
              {deliveryOrder?.delivery_status && (
                <option value="out_for_delivery">Out for delivery</option>
              )}
              {deliveryOrder?.delivery_status === 'out_for_delivery' && (
                <option value="delivered">Delivered</option>
              )}
            </select>
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="receipt-actions">
            <button type="button" disabled={busy} onClick={() => setDeliveryOrder(null)}>
              Cancel
            </button>
            <button className="primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save delivery'}
            </button>
          </div>
        </form>
      </dialog>
      <dialog
        ref={orderEditor}
        className="payment-dialog order-edit-dialog"
        aria-labelledby="edit-order-title"
        onCancel={(e) => {
          e.preventDefault();
          if (!busy) setEditOrder(null);
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void saveOrderEdit();
          }}
        >
          <h2 id="edit-order-title">Edit order #{editOrder?.id}</h2>
          <p>Update quantities, add or remove items. Current catalog prices apply when saving.</p>
          {editItems.map((item, index) => {
            const p = products.find((p) => p.id === item.product_id);
            const old = editOrder?.items.find((i) => i.product_id === item.product_id);
            return (
              <div className="order-edit-line" key={item.product_id}>
                <span>{p?.name || old?.name || 'Unavailable item'}</span>
                <input
                  aria-label={`Quantity for ${p?.name || old?.name}`}
                  type="number"
                  min="1"
                  step="1"
                  value={item.quantity}
                  disabled={busy}
                  onChange={(e) =>
                    setEditItems((items) =>
                      items.map((i, n) =>
                        n === index
                          ? { ...i, quantity: Math.max(1, Math.floor(Number(e.target.value)) || 1) }
                          : i,
                      ),
                    )
                  }
                />
                {p && productSizeOptions(p).length > 0 && (
                  <select
                    aria-label={`Size for ${p?.name || old?.name}`}
                    value={
                      productSizeOptions(p).includes(item.size) ? item.size : defaultProductSize(p)
                    }
                    disabled={busy}
                    onChange={(e) =>
                      setEditItems((items) =>
                        items.map((i, n) =>
                          n === index ? { ...i, size: e.target.value as ProductSize } : i,
                        ),
                      )
                    }
                  >
                    {productSizeOptions(p).map((size) => (
                      <option key={size} value={size}>
                        {size.charAt(0).toUpperCase() + size.slice(1)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
          <label className="order-note">
            Add product
            <select
              value=""
              disabled={busy}
              onChange={(e) => {
                const id = Number(e.target.value);
                if (id)
                  setEditItems((items) => [
                    ...items,
                    { product_id: id, quantity: 1, size: 'medium' },
                  ]);
              }}
            >
              <option value="">Choose a product</option>
              {products
                .filter(
                  (p) => p.active && p.stock > 0 && !editItems.some((i) => i.product_id === p.id),
                )
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {money(p.price_cents)}
                  </option>
                ))}
            </select>
          </label>
          <label className="order-note">
            Promotion code (optional)
            <input
              value={editPromotion}
              maxLength={40}
              disabled={busy}
              onChange={(e) => setEditPromotion(e.target.value.toUpperCase())}
            />
          </label>
          <label className="order-note">
            Order type
            <select
              value={editServiceType}
              disabled={busy}
              onChange={(e) => setEditServiceType(e.target.value as 'dine_in' | 'takeaway')}
            >
              <option value="dine_in">Dine in</option>
              <option value="takeaway">Takeaway</option>
            </select>
          </label>
          <label className="order-note">
            Payment method
            <select
              disabled={busy}
              value={editPaymentChoice}
              onChange={(e) => setEditPaymentChoice(e.target.value as 'cash' | 'card' | 'transfer')}
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="transfer">Online</option>
            </select>
          </label>
          {editPaymentChoice === 'transfer' && (
            <>
              <label className="order-note">
                Online wallet
                <select
                  disabled={busy}
                  value={transferProvider}
                  onChange={(e) => setTransferProvider(e.target.value as 'kbzpay' | 'ayapay')}
                >
                  <option value="kbzpay">KBZPay</option>
                  <option value="ayapay">AYA Pay</option>
                </select>
              </label>
              <p>Account: Thawng Kim Piang · 09428981899</p>
            </>
          )}
          {editServiceType === 'takeaway' && (
            <OrderContactFields value={editContact} onChange={setEditContact} disabled={busy} />
          )}
          <label className="order-note">
            Pickup note
            <textarea
              value={editNote}
              maxLength={500}
              disabled={busy}
              onChange={(e) => setEditNote(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="order-warning">
              {error}
            </p>
          )}
          {!editItems.length && <p>Keep at least one item, or cancel the order.</p>}
          <div className="receipt-actions">
            <button type="button" disabled={busy} onClick={() => setEditOrder(null)}>
              Cancel editing
            </button>
            <button className="primary" disabled={busy || !editItems.length} type="submit">
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </dialog>
      <dialog
        ref={payDialog}
        className="payment-dialog"
        aria-labelledby="order-payment-title"
        onCancel={(e) => {
          e.preventDefault();
          if (!busy) setPayingOrder(null);
        }}
      >
        <span className="eyebrow">FINAL PAYMENT &amp; RECEIPT</span>
        <h2 id="order-payment-title">Complete order #{payingOrder?.id}</h2>
        {payingOrder?.service_type === 'takeaway' && (
          <div className="delivery-payment-confirmed">
            <span>✓ Delivery confirmed. Record the received payment to create the bill.</span>
            {payingOrder.phone && (
              <a
                href={`sms:${payingOrder.phone}?body=${encodeURIComponent(`Your Kipi POS order #${payingOrder.id} has been delivered. Thank you!`)}`}
              >
                Message customer · {payingOrder.phone}
              </a>
            )}
          </div>
        )}
        <div className="payment-tax-summary">
          <div className="receipt-line">
            <span>Before payment discount</span>
            <b>{money(orderPreTax)}</b>
          </div>
          {customOrderDiscount > 0 && (
            <div className="receipt-line">
              <span>Custom discount</span>
              <b>−{money(customOrderDiscount)}</b>
            </div>
          )}
          <div className="receipt-line tax-line">
            <span>Tax ({Number(payingOrder?.tax_percent || 0)}%)</span>
            <b>{money(paymentTax)}</b>
          </div>
          <div className="receipt-line total">
            <b>Total</b>
            <b>{money(orderPayTotal)}</b>
          </div>
        </div>
        <label className="order-note">
          Custom customer discount (%)
          <input
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={orderDiscount}
            disabled={busy}
            onChange={(e) => setOrderDiscount(e.target.value)}
          />
          <small>Enter 0–100%. Applies to the total after any promotion.</small>
        </label>
        {!orderDiscountValid && <p role="alert">Discount must be between 0% and 100%.</p>}
        <section className={`point-payment-choice ${usePoints ? 'is-used' : 'is-unused'}`}>
          <div>
            <strong>Customer points</strong>
            <span>{availablePoints} available · 1 point = MMK 1</span>
          </div>
          <div role="group" aria-label="Use customer points">
            <button
              type="button"
              className={!usePoints ? 'selected' : ''}
              onClick={() => setUsePoints(false)}
            >
              Do not use
            </button>
            <button
              type="button"
              className={usePoints ? 'selected' : ''}
              disabled={!availablePoints || !beforePointTotal}
              onClick={() => setUsePoints(true)}
            >
              Use points
            </button>
          </div>
          {usePoints && pointsToUse > 0 && (
            <p>
              {pointsToUse} points used · −{money(pointDiscount)}
            </p>
          )}
        </section>
        <label className="order-note">
          Payment method
          <select
            disabled={busy}
            value={orderPaymentMethod}
            onChange={(e) => {
              setOrderPaymentMethod(e.target.value as 'cash' | 'card' | 'bank_transfer');
              setTransferVerified(false);
              setOrderCardConfirmed(false);
            }}
          >
            <option value="cash">Cash</option>
            <option value="card">Card on store terminal</option>
            <option value="bank_transfer">Manual transfer</option>
          </select>
        </label>
        {orderPaymentMethod === 'bank_transfer' && (
          <label className="card-confirmation">
            <input
              type="checkbox"
              disabled={busy}
              checked={transferVerified}
              onChange={(e) => setTransferVerified(e.target.checked)}
            />
            I verified this payment in the merchant account.
          </label>
        )}
        {orderPaymentMethod === 'card' && (
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
                inputMode="numeric"
                maxLength={4}
                value={cardLastFour}
                disabled={busy}
                onChange={(e) => setCardLastFour(e.target.value.replace(/[^0-9]/g, ''))}
              />
            </label>
            <label className="card-confirmation">
              <input
                type="checkbox"
                checked={orderCardConfirmed}
                disabled={busy}
                onChange={(e) => setOrderCardConfirmed(e.target.checked)}
              />
              Card terminal approved this payment.
            </label>
          </>
        )}
        {orderPaymentMethod === 'cash' && (
          <label className="order-note">
            Cash received (MMK)
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder={(orderPayTotal / 100).toFixed(2)}
              value={cash}
              disabled={busy}
              onChange={(e) => setCash(e.target.value)}
              autoFocus
            />
          </label>
        )}
        {orderPaymentMethod === 'cash' &&
          (cashValid ? (
            <div className="receipt-line">
              <span>Change to return</span>
              <b>{money(amount - orderPayTotal)}</b>
            </div>
          ) : (
            <p role="alert">Cash must cover the total.</p>
          ))}
        {error && (
          <p role="alert" className="order-warning">
            {error}
          </p>
        )}
        <p>Confirm only after receiving cash or terminal approval.</p>
        <div className="receipt-actions">
          <button disabled={busy} onClick={() => setPayingOrder(null)}>
            Cancel
          </button>
          <button
            className="primary"
            disabled={
              busy ||
              !orderDiscountValid ||
              (orderPaymentMethod === 'cash'
                ? !cashValid
                : orderPaymentMethod === 'bank_transfer'
                  ? !transferVerified
                  : !orderCardConfirmed || !!(cardLastFour && cardLastFour.length !== 4))
            }
            onClick={() => void completeOrder()}
          >
            {busy ? 'Processing…' : 'Complete payment'}
          </button>
        </div>
      </dialog>
      {paidReceiptId && <Billing receiptId={paidReceiptId} onDone={() => setPaidReceiptId(null)} />}
      <footer className="portal-footer site-footer">
        <div className="site-footer-row">
          <div className="kipi-footer-brand">
            <BrandLogo />
          </div>
          <div className="footer-contact">
            <a href="mailto:kipipos710@gmail.com">kipipos710@gmail.com</a>
            <a href="tel:09428981899">09428981899</a>
          </div>
          <div className="footer-social" aria-label="Social media">
            <a
              href="https://www.facebook.com/"
              target="_blank"
              rel="noreferrer"
              aria-label="Facebook"
              title="Facebook"
            >
              <FacebookIcon />
            </a>
            <a
              href="https://www.instagram.com/"
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
              title="Instagram"
            >
              <InstagramIcon />
            </a>
            <a
              href="https://www.tiktok.com/"
              target="_blank"
              rel="noreferrer"
              aria-label="TikTok"
              title="TikTok"
            >
              <TikTokIcon />
            </a>
          </div>
          <div className="footer-links">
            <button type="button" onClick={() => setTab('faq')}>
              FAQ
            </button>
            <button type="button" onClick={() => setTab('privacy')}>
              Privacy
            </button>
          </div>
          <small className="footer-copyright">© {new Date().getFullYear()} Kipi POS</small>
        </div>
      </footer>
    </div>
  );
}
