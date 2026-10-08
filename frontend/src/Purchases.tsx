import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from './api';
type Product = { id: number; name: string; sku: string; stock: number };
type Line = { product_id: number; quantity: number; cost: string };
type Purchase = {
  id: number;
  payment_status: string;
  payment_method: string | null;
  paid_at: string | null;
  supplier: string;
  reference: string | null;
  purchased_on: string;
  note: string | null;
  total_cents: number;
  items: { id: number; name: string; quantity: number; unit_cost_cents: number }[];
};
const money = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'MMK',
    currencyDisplay: 'code',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n / 100);
export default function Purchases() {
  const [products, setProducts] = useState<Product[]>([]),
    [purchases, setPurchases] = useState<Purchase[]>([]),
    [lines, setLines] = useState<Line[]>([]),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1),
    [status, setStatus] = useState('all'),
    [editing, setEditing] = useState<Purchase | null>(null);
  const filtered = purchases.filter((p) => status === 'all' || p.payment_status === status);
  const pages = Math.max(1, Math.ceil(filtered.length / 10)),
    current = Math.min(page, pages);
  async function mutate(task: () => Promise<unknown>) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError('');
    try {
      await task();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save purchase.');
    } finally {
      setBusy(false);
      working.current = false;
    }
  }
  const requestId = useRef(crypto.randomUUID()),
    working = useRef(false);
  async function load() {
    const [p, h] = await Promise.all([api<Product[]>('/products'), api<Purchase[]>('/purchases')]);
    setProducts(p);
    setPurchases(h);
  }
  useEffect(() => {
    void load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  const total = lines.reduce((sum, l) => sum + l.quantity * Math.round(Number(l.cost) * 100), 0);
  const valid =
    lines.length > 0 &&
    lines.every(
      (l) =>
        l.product_id &&
        Number.isInteger(l.quantity) &&
        l.quantity > 0 &&
        l.quantity <= 100000 &&
        l.cost.trim() !== '' &&
        Number.isFinite(Number(l.cost)) &&
        Number(l.cost) >= 0 &&
        Number(l.cost) <= 1000000,
    );
  function update(index: number, patch: Partial<Line>) {
    setLines((old) => old.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (working.current || !valid) return;
    const form = e.currentTarget;
    const fields = new FormData(form);
    working.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api('/purchases', {
        method: 'POST',
        body: JSON.stringify({
          ...Object.fromEntries(fields),
          request_id: requestId.current,
          items: lines.map((l) => ({
            product_id: l.product_id,
            quantity: l.quantity,
            unit_cost_cents: Math.round(Number(l.cost) * 100),
          })),
        }),
      });
      requestId.current = crypto.randomUUID();
      setLines([]);
      form.reset();
      setNotice('Purchase received. Inventory stock has been increased.');
      try {
        await load();
      } catch {
        setError('Purchase saved, but refresh failed. Reload this page to see the updated stock.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save purchase.');
    } finally {
      setBusy(false);
      working.current = false;
    }
  }
  return (
    <section className="purchase-workspace">
      {editing && (
        <form
          className="panel purchase-edit-form"
          key={editing.id}
          onSubmit={(e) => {
            e.preventDefault();
            const d = new FormData(e.currentTarget);
            void mutate(async () => {
              await api(`/purchases/${editing.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                  supplier: d.get('supplier'),
                  reference: d.get('reference'),
                  purchased_on: d.get('purchased_on'),
                  note: d.get('note'),
                  items: editing.items.map((i) => ({
                    id: i.id,
                    unit_cost_cents: Math.round(Number(d.get(`cost-${i.id}`)) * 100),
                  })),
                }),
              });
              setEditing(null);
            });
          }}
        >
          <h2>
            Edit {editing.payment_status} purchase #{editing.id}
          </h2>
          <p className="muted">
            Edit supplier, invoice, date, notes, and item costs. Received quantities and inventory
            stock stay unchanged.
          </p>
          <fieldset disabled={busy}>
            <div className="purchase-fields">
              <label>
                Supplier
                <input name="supplier" defaultValue={editing.supplier} required maxLength={150} />
              </label>
              <label>
                Invoice
                <input name="reference" defaultValue={editing.reference ?? ''} maxLength={150} />
              </label>
              <label>
                Date
                <input
                  name="purchased_on"
                  type="date"
                  defaultValue={editing.purchased_on}
                  required
                />
              </label>
            </div>
            {editing.items.map((i) => (
              <label key={i.id}>
                {i.name} · {i.quantity} units · Unit cost (MMK)
                <input
                  name={`cost-${i.id}`}
                  type="number"
                  min={0}
                  max={1000000}
                  step="0.01"
                  defaultValue={i.unit_cost_cents / 100}
                  required
                />
              </label>
            ))}
            <label>
              Notes
              <textarea name="note" defaultValue={editing.note ?? ''} maxLength={2000} />
            </label>
            <button className="primary">Save changes</button>
            <button type="button" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </fieldset>
        </form>
      )}
      <form className="panel" onSubmit={save}>
        <div className="section-heading">
          <div>
            <h2>Receive a purchase</h2>
            <p className="muted">
              Record stock received from a supplier. Quantities are added to available inventory.
            </p>
          </div>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="success" role="status">
            {notice}
          </p>
        )}
        {loading && <p role="status">Loading purchases…</p>}
        <fieldset disabled={busy || loading}>
          <div className="purchase-fields">
            <label>
              Supplier name
              <input name="supplier" required maxLength={150} placeholder="Supplier or company" />
            </label>
            <label>
              Invoice / reference
              <input name="reference" maxLength={150} placeholder="Optional invoice number" />
            </label>
            <label>
              Received date
              <input
                type="date"
                name="purchased_on"
                required
                defaultValue={new Date().toLocaleDateString('en-CA')}
              />
            </label>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Quantity received</th>
                  <th>Unit cost (MMK)</th>
                  <th>Line total</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, index) => (
                  <tr key={index}>
                    <td>
                      <select
                        aria-label={`Product ${index + 1}`}
                        value={l.product_id}
                        required
                        onChange={(e) => update(index, { product_id: Number(e.target.value) })}
                      >
                        <option value={0}>Choose product</option>
                        {products
                          .filter(
                            (p) =>
                              p.id === l.product_id || !lines.some((x) => x.product_id === p.id),
                          )
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} · {p.sku} · Stock {p.stock}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td>
                      <input
                        aria-label={`Quantity ${index + 1}`}
                        type="number"
                        min={1}
                        max={100000}
                        step={1}
                        required
                        value={l.quantity}
                        onChange={(e) => update(index, { quantity: Number(e.target.value) })}
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`Unit cost ${index + 1}`}
                        type="number"
                        min={0}
                        max={1000000}
                        step="0.01"
                        required
                        value={l.cost}
                        onChange={(e) => update(index, { cost: e.target.value })}
                      />
                    </td>
                    <td>{money(l.quantity * Math.round(Number(l.cost) * 100))}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setLines((old) => old.filter((_, i) => i !== index))}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!lines.length && <p className="empty">Add products to record a purchase.</p>}
          <button
            type="button"
            className="secondary"
            disabled={lines.length >= products.length || lines.length >= 100}
            onClick={() => setLines((old) => [...old, { product_id: 0, quantity: 1, cost: '' }])}
          >
            + Add item
          </button>
          <label className="purchase-note">
            Notes
            <textarea
              name="note"
              maxLength={2000}
              placeholder="Optional supplier or receiving notes"
            />
          </label>
          <div className="section-heading">
            <strong>Total purchase cost: {money(total)}</strong>
            <button className="primary" disabled={!valid}>
              {busy ? 'Saving…' : 'Receive purchase & add stock'}
            </button>
          </div>
        </fieldset>
      </form>
      <section className="panel">
        <h2>Purchase history</h2>
        <p className="muted">
          Received purchases with supplier payment tracking. Confirming payment automatically adds a
          linked cash-out record.
        </p>
        <div className="categories">
          {['all', 'pending', 'paid'].map((s) => (
            <button
              key={s}
              className={status === s ? 'selected' : ''}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
            >
              {s}
            </button>
          ))}
        </div>
        {filtered.slice((current - 1) * 10, current * 10).map((p) => (
          <details className="purchase-record" key={p.id}>
            <summary>
              <strong>
                Purchase #{p.id} · {p.supplier}
              </strong>
              <span>
                {p.purchased_on} · {money(p.total_cents)} · {p.payment_status}
              </span>
            </summary>
            <div className={`order-actions purchase-${p.payment_status}-actions`}>
              <button
                className="cash-edit"
                disabled={busy}
                onClick={() => {
                  setEditing(p);
                  setError('');
                  requestAnimationFrame(() =>
                    document
                      .querySelector('.purchase-edit-form')
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
                  );
                }}
              >
                Edit {p.payment_status} purchase
              </button>
              {p.payment_status === 'pending' ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const method = String(new FormData(e.currentTarget).get('payment_method'));
                    if (
                      window.confirm(
                        `Confirm full payment of ${money(p.total_cents)} to ${p.supplier}?`,
                      )
                    )
                      void mutate(async () => {
                        await api(`/purchases/${p.id}/payment`, {
                          method: 'POST',
                          body: JSON.stringify({ payment_method: method }),
                        });
                        setNotice('Purchase paid. Cash out was added automatically.');
                      });
                  }}
                >
                  <select
                    name="payment_method"
                    aria-label="Purchase payment method"
                    disabled={busy}
                  >
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank transfer</option>
                    <option value="card">Card</option>
                  </select>
                  <button className="primary" disabled={busy}>
                    Confirm & record payment
                  </button>
                </form>
              ) : (
                <span className="purchase-paid-confirmation">
                  ✓ Paid by {p.payment_method?.replace('_', ' ')} · {p.paid_at}
                </span>
              )}
            </div>
            {p.reference && <p>Invoice: {p.reference}</p>}
            {p.note && <p>{p.note}</p>}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Quantity</th>
                    <th>Unit cost</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {p.items.map((i) => (
                    <tr key={i.id}>
                      <td>{i.name}</td>
                      <td>{i.quantity}</td>
                      <td>{money(i.unit_cost_cents)}</td>
                      <td>{money(i.quantity * i.unit_cost_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ))}
        {filtered.length > 0 && (
          <nav className="order-pagination" aria-label="Purchase history pages">
            <span>
              Showing {(current - 1) * 10 + 1}–{Math.min(current * 10, filtered.length)} of{' '}
              {filtered.length}
            </span>
            <button disabled={current === 1} onClick={() => setPage(current - 1)}>
              Previous
            </button>
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                className={current === n ? 'selected' : ''}
                aria-current={current === n ? 'page' : undefined}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
            ))}
            <button disabled={current === pages} onClick={() => setPage(current + 1)}>
              Next
            </button>
          </nav>
        )}
        {!loading && !filtered.length && <p className="empty">No purchases recorded yet.</p>}
      </section>
    </section>
  );
}
