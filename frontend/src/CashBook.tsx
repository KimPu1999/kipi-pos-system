import { useEffect, useState, type FormEvent } from 'react';
import { api } from './api';
import { Banknote, Plus, Minus, Trash2, Printer } from './icons';
type Entry = {
  id: number;
  type: 'in' | 'out';
  payment_status: 'paid' | 'unpaid';
  paid_at: string | null;
  amount_cents: number;
  category: string;
  reference: string | null;
  entry_date: string;
  note: string | null;
  recorded_by: string | null;
  created_at: string;
  source_type: string | null;
  source_id: number | null;
};
type CashData = {
  cash_in_cents: number;
  cash_out_cents: number;
  unpaid_cents: number;
  balance_cents: number;
  entries: Entry[];
};
const empty: CashData = {
  cash_in_cents: 0,
  cash_out_cents: 0,
  unpaid_cents: 0,
  balance_cents: 0,
  entries: [],
};
const money = (c: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'MMK',
    currencyDisplay: 'code',
    maximumFractionDigits: 0,
  }).format(c / 100);
export default function CashBook() {
  const [data, setData] = useState<CashData>(empty),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [filter, setFilter] = useState<
      'all' | 'in' | 'out' | 'paid' | 'unpaid' | 'purchase' | 'employee' | 'manual'
    >('all'),
    [page, setPage] = useState(1),
    [editing, setEditing] = useState<Entry | null>(null),
    [printing, setPrinting] = useState(false),
    [focusId] = useState(() => Number(sessionStorage.getItem('kipiCashFocus')) || 0);
  async function load() {
    setData(await api<CashData>('/cash-entries'));
  }
  useEffect(() => {
    void load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!focusId || !data.entries.length) return;
    const index = data.entries.findIndex((entry) => entry.id === focusId);
    if (index < 0) return;
    setFilter('all');
    setPage(Math.floor(index / 10) + 1);
    sessionStorage.removeItem('kipiCashFocus');
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        document
          .getElementById(`cash-entry-${focusId}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
      ),
    );
  }, [focusId, data.entries]);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget,
      d = new FormData(form);
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(editing ? `/cash-entries/${editing.id}` : '/cash-entries', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify({
          type: d.get('type'),
          payment_status: d.get('payment_status'),
          amount_cents: Math.round(Number(d.get('amount')) * 100),
          category: d.get('category'),
          reference: d.get('reference') || null,
          entry_date: d.get('entry_date'),
          note: d.get('note') || null,
        }),
      });
      setEditing(null);
      form.reset();
      setNotice(editing ? 'Cash entry updated. Totals recalculated.' : 'Cash entry saved.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save cash entry.');
    } finally {
      setBusy(false);
    }
  }
  async function remove(entry: Entry) {
    if (
      !window.confirm(
        `Delete this ${entry.type === 'in' ? 'cash in' : 'cash out'} entry of ${money(entry.amount_cents)}?`,
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      await api(`/cash-entries/${entry.id}`, { method: 'DELETE' });
      setNotice('Cash entry deleted.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to delete cash entry.');
    } finally {
      setBusy(false);
    }
  }
  async function recordPayment(entry: Entry) {
    if (!window.confirm(`Record ${money(entry.amount_cents)} as paid?`)) return;
    setBusy(true);
    setError('');
    try {
      await api(`/cash-entries/${entry.id}/payment`, { method: 'POST' });
      setNotice('Payment recorded. Cash balance updated.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to record payment.');
    } finally {
      setBusy(false);
    }
  }
  function printCashbook() {
    setPrinting(true);
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => {
        const done = () => {
          document.body.classList.remove('cashbook-printing');
          window.removeEventListener('afterprint', done);
          setPrinting(false);
        };
        document.body.classList.add('cashbook-printing');
        window.addEventListener('afterprint', done);
        window.print();
        window.setTimeout(done, 1000);
      }),
    );
  }
  const filtered = data.entries.filter(
      (entry) =>
        filter === 'all' ||
        entry.type === filter ||
        entry.payment_status === filter ||
        (filter === 'purchase' && entry.source_type === 'purchase') ||
        (filter === 'employee' && entry.source_type === 'employee_salary') ||
        (filter === 'manual' && !entry.source_type),
    ),
    purchaseTotal = data.entries
      .filter((e) => e.source_type === 'purchase' && e.payment_status === 'paid')
      .reduce((n, e) => n + e.amount_cents, 0),
    salaryTotal = data.entries
      .filter((e) => e.source_type === 'employee_salary' && e.payment_status === 'paid')
      .reduce((n, e) => n + e.amount_cents, 0),
    manualCount = data.entries.filter((e) => !e.source_type).length,
    pages = Math.max(1, Math.ceil(filtered.length / 10)),
    current = Math.min(page, pages),
    shown = printing ? filtered : filtered.slice((current - 1) * 10, current * 10);
  return (
    <section className="cashbook-workspace">
      <div className="cash-print-title">
        <h1>Kipi POS · Cashbook</h1>
        <p>Cash in, cash out, paid and unpaid records · {new Date().toLocaleString()}</p>
      </div>
      <div className="cashbook-toolbar">
        <div>
          <span className="eyebrow">CASHBOOK REPORT</span>
          <h2>Cash in / cash out</h2>
        </div>
        <div>
          <a className="secondary cash-export" href="/api/cash-entries/export" download>
            Export Excel
          </a>
          <a className="secondary cash-export" href="/api/cash-entries/export-pdf" download>
            Export PDF
          </a>
          <button type="button" className="secondary cash-print" onClick={printCashbook}>
            <Printer size={17} /> Print
          </button>
        </div>
      </div>
      <div className="cashbook-summary">
        <article className="cash-card cash-balance">
          <Banknote size={23} />
          <span>Cash balance</span>
          <b>{money(data.balance_cents)}</b>
        </article>
        <article className="cash-card cash-in">
          <Plus size={23} />
          <span>Total cash in</span>
          <b>{money(data.cash_in_cents)}</b>
        </article>
        <article className="cash-card cash-out">
          <Minus size={23} />
          <span>Total cash out</span>
          <b>{money(data.cash_out_cents)}</b>
        </article>
        <article className="cash-card cash-unpaid">
          <Banknote size={23} />
          <span>Total unpaid</span>
          <b>{money(data.unpaid_cents)}</b>
        </article>
      </div>
      <div className="cash-source-summary">
        <button
          type="button"
          className={filter === 'purchase' ? 'selected' : ''}
          onClick={() => {
            setFilter('purchase');
            setPage(1);
          }}
        >
          <span>Purchase cash out</span>
          <b>{money(purchaseTotal)}</b>
          <small>{data.entries.filter((e) => e.source_type === 'purchase').length} records</small>
        </button>
        <button
          type="button"
          className={filter === 'employee' ? 'selected' : ''}
          onClick={() => {
            setFilter('employee');
            setPage(1);
          }}
        >
          <span>Employee salary cash out</span>
          <b>{money(salaryTotal)}</b>
          <small>
            {data.entries.filter((e) => e.source_type === 'employee_salary').length} records
          </small>
        </button>
        <button
          type="button"
          className={filter === 'manual' ? 'selected' : ''}
          onClick={() => {
            setFilter('manual');
            setPage(1);
          }}
        >
          <span>Manual cash history</span>
          <b>{manualCount}</b>
          <small>cash entries</small>
        </button>
      </div>
      <form
        key={editing?.id ?? 'new'}
        className={`panel cash-entry-form${editing ? ' is-editing' : ''}`}
        onSubmit={save}
      >
        <div className="section-heading">
          <div>
            <span className="eyebrow">CASH REGISTER</span>
            <h2>{editing ? `Edit ${editing.category}` : 'Add cash history'}</h2>
            <p className="muted">
              Record money received or money paid outside completed POS sales.
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
        <fieldset disabled={busy || loading}>
          <div className="cash-entry-grid">
            <label>
              Transaction type
              <select name="type" required defaultValue={editing?.type ?? 'in'}>
                <option value="in">Cash in</option>
                <option value="out">Cash out</option>
              </select>
            </label>
            <label>
              Payment status
              <select
                name="payment_status"
                required
                defaultValue={editing?.payment_status ?? 'paid'}
              >
                <option value="paid">Paid now</option>
                <option value="unpaid">Unpaid / pay later</option>
              </select>
            </label>
            <label>
              Amount (MMK)
              <input
                name="amount"
                type="number"
                min="1"
                max="1000000000"
                step="1"
                required
                placeholder="10000"
                defaultValue={editing ? editing.amount_cents / 100 : undefined}
              />
            </label>
            <label>
              Date
              <input
                name="entry_date"
                type="date"
                required
                defaultValue={editing?.entry_date ?? new Date().toLocaleDateString('en-CA')}
              />
            </label>
            <label>
              Category
              <input
                name="category"
                list="cash-categories"
                required
                maxLength={100}
                placeholder="Sales, supplies, rent…"
                defaultValue={editing?.category}
              />
              <datalist id="cash-categories">
                <option value="Opening balance" />
                <option value="Sales deposit" />
                <option value="Supplies" />
                <option value="Rent" />
                <option value="Utilities" />
                <option value="Petty cash" />
                <option value="Refund" />
              </datalist>
            </label>
            <label>
              Reference
              <input
                name="reference"
                maxLength={150}
                placeholder="Receipt or invoice (optional)"
                defaultValue={editing?.reference ?? ''}
              />
            </label>
            <label className="cash-note">
              Note
              <textarea
                name="note"
                maxLength={2000}
                placeholder="Optional details"
                defaultValue={editing?.note ?? ''}
              />
            </label>
          </div>
          <div className="cash-form-actions">
            <button className="primary" disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Add cash history'}
            </button>
            {editing && (
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => setEditing(null)}
              >
                Cancel editing
              </button>
            )}
          </div>
        </fieldset>
      </form>
      <section className="panel cash-history">
        <div className="section-heading">
          <div>
            <h2>Cash history</h2>
            <p className="muted">
              Manual and automatic purchase or salary entries are listed by transaction date.
            </p>
          </div>
          <div className="cash-history-heading-actions">
            <a
              className="secondary cash-history-pdf"
              href={`/api/cash-entries/export-pdf?filter=${filter}`}
              download
            >
              Download history PDF
            </a>
            <button className="secondary" disabled={busy || loading} onClick={() => void load()}>
              Refresh
            </button>
          </div>
        </div>
        <div className="categories">
          {(['all', 'purchase', 'employee', 'manual', 'in', 'out', 'paid', 'unpaid'] as const).map(
            (type) => (
              <button
                key={type}
                className={filter === type ? 'selected' : ''}
                onClick={() => {
                  setFilter(type);
                  setPage(1);
                }}
              >
                {type === 'all'
                  ? 'All history'
                  : type === 'purchase'
                    ? 'Purchases'
                    : type === 'employee'
                      ? 'Employee salaries'
                      : type === 'manual'
                        ? 'Manual entries'
                        : type === 'in'
                          ? 'Cash in'
                          : type === 'out'
                            ? 'Cash out'
                            : type === 'paid'
                              ? 'Paid'
                              : 'Unpaid'}
              </button>
            ),
          )}
        </div>
        {loading && <p role="status">Loading cash entries…</p>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Payment</th>
                <th>Category</th>
                <th>Reference</th>
                <th>Recorded by</th>
                <th>Amount</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((entry) => (
                <tr
                  key={entry.id}
                  id={`cash-entry-${entry.id}`}
                  className={entry.id === focusId ? 'cash-entry-focused' : ''}
                >
                  <td>{entry.entry_date}</td>
                  <td>
                    <span className={`cash-type cash-type-${entry.type}`}>
                      {entry.type === 'in' ? 'Cash in' : 'Cash out'}
                    </span>
                  </td>
                  <td>
                    <span className={`cash-payment cash-payment-${entry.payment_status}`}>
                      {entry.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                    </span>
                  </td>
                  <td>
                    <b>{entry.category}</b>
                    {entry.source_type && (
                      <small className="cash-entry-note">
                        Automatic ·{' '}
                        {entry.source_type === 'purchase' ? 'Purchase' : 'Employee salary'}
                      </small>
                    )}
                    {entry.note && <small className="cash-entry-note">{entry.note}</small>}
                  </td>
                  <td>{entry.reference || '—'}</td>
                  <td>{entry.recorded_by || 'Admin'}</td>
                  <td className={entry.type === 'in' ? 'cash-amount-in' : 'cash-amount-out'}>
                    {entry.type === 'in' ? '+' : '−'}
                    {money(entry.amount_cents)}
                  </td>
                  <td>
                    <div className="cash-actions">
                      {entry.source_type ? (
                        <span className="cash-payment cash-payment-paid">Linked</span>
                      ) : (
                        <>
                          <button
                            className="cash-edit"
                            disabled={busy}
                            onClick={() => {
                              setEditing(entry);
                              setError('');
                              setNotice('');
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                          >
                            Edit
                          </button>
                          {entry.payment_status === 'unpaid' && (
                            <button
                              className="cash-pay"
                              disabled={busy}
                              onClick={() => void recordPayment(entry)}
                            >
                              Record payment
                            </button>
                          )}
                          <button
                            className="cash-delete"
                            disabled={busy}
                            onClick={() => void remove(entry)}
                          >
                            <Trash2 size={15} /> Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && !shown.length && <p className="empty">No cash entries found.</p>}
        {filtered.length > 0 && (
          <nav className="order-pagination" aria-label="Cash history pages">
            <span>
              Showing {(current - 1) * 10 + 1}–{Math.min(current * 10, filtered.length)} of{' '}
              {filtered.length}
            </span>
            <button disabled={current === 1} onClick={() => setPage(current - 1)}>
              Previous
            </button>
            {Array.from({ length: pages }, (_, i) => i + 1).map((number) => (
              <button
                key={number}
                className={current === number ? 'selected' : ''}
                onClick={() => setPage(number)}
              >
                {number}
              </button>
            ))}
            <button disabled={current === pages} onClick={() => setPage(current + 1)}>
              Next
            </button>
          </nav>
        )}
      </section>
    </section>
  );
}
