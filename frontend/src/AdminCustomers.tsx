import { useMemo, useRef, useState, type FormEvent } from 'react';
import { api } from './api';
import { Search, Trash2, Users } from './icons';
import CustomerRewards from './CustomerRewards';
type Customer = {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
  status: 'active' | 'inactive';
  customer_number: string | null;
  store_notes: string | null;
};
type Order = {
  id: number;
  user_id?: number;
  customer_email: string;
  status: string;
  total_cents: number;
  created_at: string;
};
const money = (c: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'MMK',
    currencyDisplay: 'code',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(c / 100);
export default function AdminCustomers({
  people,
  orders,
}: {
  people: Customer[];
  orders: Order[];
}) {
  const [records, setRecords] = useState(() =>
      people.filter((person) => person.role === 'customer'),
    ),
    [query, setQuery] = useState(''),
    [selected, setSelected] = useState<number | null>(null),
    [editing, setEditing] = useState<Customer | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [revealPassword, setRevealPassword] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null),
    confirmRef = useRef<HTMLInputElement>(null);
  function generatePassword() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    const bytes = new Uint32Array(16);
    crypto.getRandomValues(bytes);
    const password = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
    if (passwordRef.current) passwordRef.current.value = password;
    if (confirmRef.current) confirmRef.current.value = password;
    setRevealPassword(true);
    setError('');
    setNotice('Temporary password generated. Copy it and share it with the customer securely.');
  }
  const visible = useMemo(
    () =>
      records.filter((c) =>
        `${c.name} ${c.email}`.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [records, query],
  );
  const customer = records.find((c) => c.id === selected) || null;
  const customerOrders = customer
    ? orders.filter(
        (order) =>
          order.user_id === customer.id ||
          order.customer_email.toLowerCase() === customer.email.toLowerCase(),
      )
    : [];
  const completed = customerOrders.filter((order) => order.status === 'completed'),
    open = customerOrders.filter((order) =>
      ['pending', 'confirmed', 'ready'].includes(order.status),
    );
  function viewCustomer(id: number) {
    setSelected(id);
    requestAnimationFrame(() =>
      document
        .querySelector('.customer-control-detail')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  }
  function editCustomer(person: Customer) {
    setEditing(person);
    setError('');
    setNotice('');
    requestAnimationFrame(() =>
      document
        .querySelector('.admin-customer-edit')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
    );
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const d = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      const updated = await api<Customer>(`/admin/customers/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: d.get('status'),
          customer_number: d.get('customer_number') || null,
          store_notes: editing.store_notes,
        }),
      });
      setRecords((old) => old.map((c) => (c.id === updated.id ? updated : c)));
      setEditing(null);
      setNotice('Store customer record updated.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update customer.');
    } finally {
      setBusy(false);
    }
  }
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const d = new FormData(form);
    setBusy(true);
    setError('');
    try {
      const customer = await api<Customer>('/admin/customers', {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(d.entries())),
      });
      setRecords((old) => [customer, ...old]);
      form.reset();
      setRevealPassword(false);
      setNotice(
        'Customer created for this store. Share the temporary password with them; they must sign in themselves.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create customer.');
    } finally {
      setBusy(false);
    }
  }
  async function remove(person: Customer) {
    if (
      !confirm(
        `Remove ${person.name} from this store? Their login and transaction history will remain.`,
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      await api(`/admin/customers/${person.id}`, { method: 'DELETE' });
      setRecords((old) => old.filter((c) => c.id !== person.id));
      if (selected === person.id) setSelected(null);
      if (editing?.id === person.id) setEditing(null);
      setNotice('Customer removed from this store.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to delete customer.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="customer-admin-workspace">
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
      <form className="panel admin-customer-edit" onSubmit={create}>
        <div className="section-heading">
          <div>
            <span className="eyebrow">NEW STORE CUSTOMER</span>
            <h2>Create customer</h2>
            <p className="muted">The backend assigns this customer to your authorized store.</p>
          </div>
        </div>
        <fieldset disabled={busy}>
          <label>
            Name
            <input name="name" required maxLength={100} />
          </label>
          <label>
            Email
            <input name="email" type="email" required maxLength={254} />
          </label>
          <label>
            Temporary password
            <input
              ref={passwordRef}
              name="password"
              type={revealPassword ? 'text' : 'password'}
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
            />
          </label>
          <label>
            Confirm password
            <input
              ref={confirmRef}
              name="password_confirmation"
              type={revealPassword ? 'text' : 'password'}
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
            />
          </label>
          <div>
            <button type="button" className="secondary" onClick={generatePassword} disabled={busy}>
              Generate temporary password
            </button>
          </div>
          <label>
            Customer number
            <input name="customer_number" maxLength={100} />
          </label>
          <button className="primary">{busy ? 'Creating…' : 'Create customer'}</button>
        </fieldset>
      </form>
      <section className="panel customer-directory">
        <div className="section-heading">
          <div>
            <span className="eyebrow">CUSTOMER CONTROL</span>
            <h2>
              <Users size={20} /> Registered customers
            </h2>
            <p className="muted">View and manage customers associated with this store.</p>
          </div>
          <strong>{records.length} customers</strong>
        </div>
        <label className="search">
          <Search size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customer name or email…"
          />
        </label>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Joined</th>
                <th>Orders</th>
                <th>Status</th>
                <th>Control</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((person) => {
                const own = orders.filter(
                  (order) =>
                    order.user_id === person.id ||
                    order.customer_email.toLowerCase() === person.email.toLowerCase(),
                );
                const active = own.filter((order) =>
                  ['pending', 'confirmed', 'ready'].includes(order.status),
                ).length;
                return (
                  <tr className={selected === person.id ? 'is-selected' : ''} key={person.id}>
                    <td>
                      <div className="customer-account-cell">
                        <span>{person.name.slice(0, 2).toUpperCase()}</span>
                        <div>
                          <b>{person.name}</b>
                          <small>{person.email}</small>
                        </div>
                      </div>
                    </td>
                    <td>{new Date(person.created_at).toLocaleDateString()}</td>
                    <td>{own.length}</td>
                    <td>
                      <span className={active ? 'customer-active-orders' : 'customer-no-active'}>
                        {active ? `${active} active` : 'No active orders'}
                      </span>
                    </td>
                    <td>
                      <div className="customer-control-actions">
                        <button
                          className="customer-action-link customer-view-link"
                          disabled={busy}
                          onClick={() => viewCustomer(person.id)}
                        >
                          View record
                        </button>
                        <button
                          className="customer-action-link customer-edit-link"
                          disabled={busy}
                          onClick={() => editCustomer(person)}
                        >
                          Edit store record
                        </button>
                        <button
                          className="cash-delete"
                          disabled={busy}
                          onClick={() => void remove(person)}
                        >
                          <Trash2 size={15} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!visible.length && <p className="empty">No customers match this search.</p>}
      </section>
      {editing && (
        <form className="panel admin-customer-edit" onSubmit={save}>
          <div className="section-heading">
            <div>
              <span className="eyebrow">EDIT STORE CUSTOMER</span>
              <h2>{editing.name}</h2>
            </div>
          </div>
          <fieldset disabled={busy}>
            <label>
              Status
              <select name="status" defaultValue={editing.status}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label>
              Customer number
              <input
                name="customer_number"
                maxLength={100}
                defaultValue={editing.customer_number || ''}
              />
            </label>
            <div>
              <button type="button" className="secondary" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button className="primary">{busy ? 'Saving…' : 'Save customer'}</button>
            </div>
          </fieldset>
        </form>
      )}
      {customer && (
        <section className="customer-control-detail">
          <div className="panel customer-profile-summary">
            <div className="customer-profile-heading">
              <span>{customer.name.slice(0, 2).toUpperCase()}</span>
              <div>
                <h2>{customer.name}</h2>
                <a href={`mailto:${customer.email}`}>{customer.email}</a>
                <small>Customer since {new Date(customer.created_at).toLocaleDateString()}</small>
              </div>
              <button className="secondary" onClick={() => setSelected(null)}>
                Close record
              </button>
            </div>
            <div className="customer-control-metrics">
              <div>
                <span>All orders</span>
                <b>{customerOrders.length}</b>
              </div>
              <div>
                <span>Open orders</span>
                <b>{open.length}</b>
              </div>
              <div>
                <span>Completed</span>
                <b>{completed.length}</b>
              </div>
              <div>
                <span>Completed value</span>
                <b>{money(completed.reduce((sum, order) => sum + order.total_cents, 0))}</b>
              </div>
            </div>
          </div>
          <CustomerRewards customerId={customer.id} />
        </section>
      )}
    </section>
  );
}
