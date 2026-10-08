import { useEffect, useState } from 'react';
import { api } from './api';
type Item = {
  id: number;
  name: string;
  sku: string;
  category: string;
  price_cents: number;
  stock: number;
  active: boolean | number;
  image_path: string | null;
  emoji: string;
};
const money = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'MMK',
    currencyDisplay: 'code',
    maximumFractionDigits: 2,
  }).format(n / 100);
export default function MenuItems({ manage }: { manage: () => void }) {
  const [items, setItems] = useState<Item[]>([]),
    [search, setSearch] = useState(''),
    [category, setCategory] = useState('All'),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    void api<Item[]>('/products')
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  const visible = items.filter(
    (i) =>
      (category === 'All' || i.category === category) &&
      `${i.name} ${i.sku}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Menu items</h2>
          <p className="muted">Your product catalog supplies the menu, customer shop and POS.</p>
        </div>
        <button className="primary" onClick={manage}>
          Add / edit menu items
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <label className="search">
        <input
          placeholder="Search menu item or SKU"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <div className="categories">
        {['All', ...new Set(items.map((i) => i.category))].map((c) => (
          <button
            key={c}
            className={category === c ? 'selected' : ''}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>
      {loading && <p role="status">Loading menu…</p>}
      <div className="dining-table-grid">
        {visible.map((i) => (
          <article className="dining-table-card" key={i.id}>
            {i.image_path ? (
              <img className="menu-item-image" src={`/api/products/${i.id}/image`} alt={i.name} />
            ) : (
              <span className="menu-item-emoji">{i.emoji}</span>
            )}
            <h3>{i.name}</h3>
            <p>
              {i.category} · {i.sku}
            </p>
            <strong>{money(i.price_cents)}</strong>
            <p>
              {i.active ? 'Active' : 'Inactive'} · {i.stock} in stock
            </p>
          </article>
        ))}
      </div>
      {!loading && !visible.length && <p className="empty">No menu items found.</p>}
    </section>
  );
}
