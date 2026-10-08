import CopyCode from './CopyCode';
import { useEffect, useState, type FormEvent } from 'react';
import { api } from './api';
export type Promotion = {
  product_ids: number[];
  id: number;
  code: string;
  name: string;
  percent: number;
  active: boolean | number;
  expires_on: string | null;
  image_path: string | null;
};
const promotionCode = () =>
  `PROMO-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
export default function Promotions() {
  const [products, setProducts] = useState<
    { id: number; name: string; active: boolean | number }[]
  >([]);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [items, setItems] = useState<Promotion[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  function prepare(d: FormData) {
    d.set('product_ids', JSON.stringify(d.getAll('product_ids[]').map(Number)));
    d.delete('product_ids[]');
    const f = d.get('image');
    if (f instanceof File && !f.size) d.delete('image');
    return d;
  }
  async function load() {
    const [promo, items] = await Promise.all([
      api<Promotion[]>('/promotions'),
      api<{ id: number; name: string; active: boolean | number }[]>('/products'),
    ]);
    setItems(promo);
    setProducts(items);
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, []);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const d = new FormData(form);
    if (editing) d.set('_method', 'PUT');
    setBusy(true);
    setError('');
    try {
      await api(editing ? `/promotions/${editing.id}` : '/promotions', {
        method: 'POST',
        body: prepare(d),
      });
      form.reset();
      if (!editing) {
        const code = form.querySelector<HTMLInputElement>('input[name=code]');
        if (code) {
          code.value = promotionCode();
          code.defaultValue = code.value;
        }
      }
      setNotice(editing ? 'Promotion updated.' : 'Promotion created.');
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save.');
    } finally {
      setBusy(false);
    }
  }
  async function upload(p: Promotion, file: File) {
    setBusy(true);
    setError('');
    const body = new FormData();
    body.set('image', file);
    try {
      await api(`/promotions/${p.id}/image`, { method: 'POST', body });
      setNotice('Promotion image saved.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }
  async function remove(p: Promotion) {
    if (!window.confirm(`Delete ${p.name}? Past order discounts will be preserved.`)) return;
    setBusy(true);
    setError('');
    try {
      await api(`/promotions/${p.id}`, { method: 'DELETE' });
      if (editing?.id === p.id) setEditing(null);
      setNotice('Promotion deleted.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to delete.');
    } finally {
      setBusy(false);
    }
  }
  async function toggle(p: Promotion) {
    setBusy(true);
    setError('');
    try {
      await api(`/promotions/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !p.active }),
      });
      setNotice(p.active ? 'Promotion deactivated.' : 'Promotion confirmed and active.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel products-panel promotions-workspace">
      <h2>Promotions & discounts</h2>
      <p className="products-description">
        Create percentage discount codes for customer orders. Expiry dates use UTC.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="success">
          {notice}
        </p>
      )}
      <form key={editing?.id || 'new'} className="product-form" onSubmit={create}>
        <div className="product-edit-heading">
          <h2>{editing ? 'Edit promotion' : 'Create promotion'}</h2>
        </div>
        <label>
          Promotion name
          <input defaultValue={editing?.name || ''} name="name" required maxLength={100} />
        </label>
        <label>
          Discount code
          <input
            defaultValue={editing?.code || promotionCode()}
            name="code"
            required
            maxLength={40}
            pattern="[A-Za-z0-9_-]+"
            placeholder="WELCOME10"
          />
        </label>
        <label>
          Discount (%)
          <input
            defaultValue={editing?.percent}
            name="percent"
            type="number"
            required
            min="1"
            max="100"
            step="1"
          />
        </label>
        <label>
          Expiry date (optional)
          <input defaultValue={editing?.expires_on || ''} name="expires_on" type="date" />
        </label>
        <fieldset className="promotion-products">
          <legend>Eligible products</legend>
          <p>Select products to discount. Leave all unchecked for a store-wide offer.</p>
          <div>
            {products.map((p) => (
              <label key={p.id}>
                <input
                  type="checkbox"
                  name="product_ids[]"
                  value={p.id}
                  defaultChecked={!!editing?.product_ids.includes(p.id)}
                  disabled={busy}
                />
                {p.name}
                {!p.active && ' (inactive)'}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="image-upload">
          Promotion image
          <input
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
          />
          <small>JPG, PNG or WebP · Up to 2 MB</small>
        </label>
        <button className="primary" disabled={busy}>
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Create promotion'}
        </button>
        {editing && (
          <button type="button" disabled={busy} onClick={() => setEditing(null)}>
            Cancel edit
          </button>
        )}
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Image</th>
              <th>Name</th>
              <th>Code</th>
              <th>Discount</th>
              <th>Products</th>
              <th>Expires</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.image_path ? (
                    <img
                      className="promotion-admin-image"
                      src={`/api/promotions/${p.id}/image`}
                      alt={p.name}
                    />
                  ) : (
                    <span className="muted">No image</span>
                  )}
                  <label className="promotion-image-change">
                    {p.image_path ? 'Change image' : 'Upload image'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={busy}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (file) void upload(p, file);
                      }}
                    />
                  </label>
                </td>
                <td>{p.name}</td>
                <td>
                  <CopyCode key={p.code} code={p.code} />
                </td>
                <td>{p.percent}%</td>
                <td>
                  {p.product_ids.length
                    ? p.product_ids
                        .map((id) => products.find((x) => x.id === id)?.name || `#${id}`)
                        .join(', ')
                    : 'All products'}
                </td>
                <td>{p.expires_on || 'No expiry'}</td>
                <td>
                  {!p.active
                    ? 'Inactive'
                    : p.expires_on && p.expires_on < new Date().toISOString().slice(0, 10)
                      ? 'Expired'
                      : 'Active'}
                </td>
                <td className="promotion-actions">
                  <button
                    className="promotion-edit"
                    disabled={busy}
                    onClick={() => {
                      setEditing(p);
                      setError('');
                      setNotice('');
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="promotion-confirm"
                    disabled={busy || !!p.active}
                    onClick={() => void toggle(p)}
                  >
                    {p.active ? 'Confirmed' : 'Confirm'}
                  </button>
                  {!!p.active && (
                    <button
                      className="promotion-deactivate"
                      disabled={busy}
                      onClick={() => void toggle(p)}
                    >
                      Deactivate
                    </button>
                  )}
                  <button
                    className="promotion-delete"
                    disabled={busy}
                    onClick={() => void remove(p)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!items.length && <p className="empty">Create your first promotion above.</p>}
    </section>
  );
}
