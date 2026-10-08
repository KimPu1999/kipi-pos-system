import { useMemo, useState, type FormEvent } from 'react';
import { api } from './api';
import { Search, Trash2, Users } from './icons';
import CustomerRewards from './CustomerRewards';
type Customer = { id: number; name: string; email: string; role: string; created_at: string };
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
    [notice, setNotice] = useState('');
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
          name: d.get('name'),
          email: d.get('email'),
          password: d.get('password') || null,
          password_confirmation: d.get('password_confirmation') || null,
        }),
      });
      setRecords((old) => old.map((c) => (c.id === updated.id ? updated : c)));
      setEditing(null);
      setNotice('Customer account updated.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update customer.');
    } finally {
      setBusy(false);
    }
  }
  async function remove(person: Customer) {
    if (
      !confirm(
        `Delete ${person.name}'s customer login? Their financial transaction history will remain.`,
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
      setNotice('Customer login and personal profile deleted.');
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
      <section className="panel customer-directory">
        <div className="section-heading">
          <div>
            <span className="eyebrow">CUSTOMER CONTROL</span>
            <h2>
              <Users size={20} /> Registered customers
            </h2>
            <p className="muted">View, edit, reset the password, or remove a customer login.</p>
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
                          Edit account
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
              <span className="eyebrow">EDIT CUSTOMER LOGIN</span>
              <h2>{editing.name}</h2>
            </div>
          </div>
          <fieldset disabled={busy}>
            <label>
              Name
              <input name="name" required maxLength={100} defaultValue={editing.name} />
            </label>
            <label>
              Email
              <input
                name="email"
                type="email"
                required
                maxLength={254}
                defaultValue={editing.email}
              />
            </label>
            <label>
              New password (optional)
              <input
                name="password"
                type="password"
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
              />
            </label>
            <label>
              Confirm new password
              <input
                name="password_confirmation"
                type="password"
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
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
