import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api } from './api';
import type { Settings } from './systemSettings';
import { Banknote } from './icons';
type Sale = {
  id: number;
  created_at: string;
  subtotal_cents: number;
  discount_cents: number;
  tax_percent: number;
  tax_cents: number;
  total_cents: number;
  payment_method: string;
};
const money = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'MMK',
    currencyDisplay: 'code',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value / 100);
const localDay = (value: string | Date) => {
  const date =
    value instanceof Date
      ? value
      : new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Yangon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};
export default function Tax() {
  const [settings, setSettings] = useState<Settings | null>(null),
    [sales, setSales] = useState<Sale[]>([]),
    [rate, setRate] = useState('0'),
    [page, setPage] = useState(1),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  async function load() {
    const [current, receipts] = await Promise.all([
      api<Settings>('/settings'),
      api<Sale[]>('/sales'),
    ]);
    setSettings(current);
    setRate(String(current.tax_percent));
    setSales(receipts);
  }
  useEffect(() => {
    void load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  const today = localDay(new Date()),
    month = today.slice(0, 7),
    taxable = useMemo(() => sales.filter((s) => Number(s.tax_cents) > 0), [sales]);
  const todayTax = taxable
      .filter((s) => localDay(s.created_at) === today)
      .reduce((sum, s) => sum + Number(s.tax_cents), 0),
    monthTax = taxable
      .filter((s) => localDay(s.created_at).startsWith(month))
      .reduce((sum, s) => sum + Number(s.tax_cents), 0),
    allTax = taxable.reduce((sum, s) => sum + Number(s.tax_cents), 0),
    pages = Math.max(1, Math.ceil(taxable.length / 10)),
    current = Math.min(page, pages),
    shown = taxable.slice((current - 1) * 10, current * 10);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!settings) return;
    const value = Number(rate);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      setError('Tax percentage must be between 0 and 100.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const updated = await api<Settings>('/settings', {
        method: 'PUT',
        body: JSON.stringify({ ...settings, tax_percent: value }),
      });
      setSettings(updated);
      setRate(String(updated.tax_percent));
      setNotice(
        value === 0
          ? 'Tax disabled for new orders and sales.'
          : `Tax updated to ${value}%. New orders and sales will use this rate.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save tax settings.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="tax-workspace">
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
      <section className="panel tax-settings-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">TAX CONTROL</span>
            <h2>
              <Banknote size={21} /> Tax settings
            </h2>
            <p className="muted">
              Tax is calculated after discounts. Saved receipts keep their original tax rate.
            </p>
          </div>
          <span className={Number(settings?.tax_percent) ? 'tax-state is-active' : 'tax-state'}>
            {Number(settings?.tax_percent) ? 'Active' : 'Disabled'}
          </span>
        </div>
        {loading ? (
          <p role="status">Loading tax information…</p>
        ) : (
          <form onSubmit={save}>
            <label>
              Tax percentage
              <div>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  required
                  value={rate}
                  disabled={busy}
                  onChange={(e) => setRate(e.target.value)}
                />
                <span>%</span>
              </div>
              <small>Enter 0% to disable tax for new orders and POS sales.</small>
            </label>
            <button className="primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save tax rate'}
            </button>
          </form>
        )}
      </section>
      <div className="tax-summary-grid">
        <article className="panel">
          <span>Current rate</span>
          <b>{Number(settings?.tax_percent || 0)}%</b>
          <small>Applied to new transactions</small>
        </article>
        <article className="panel">
          <span>Tax today</span>
          <b>{money(todayTax)}</b>
          <small>{today}</small>
        </article>
        <article className="panel">
          <span>Tax this month</span>
          <b>{money(monthTax)}</b>
          <small>{month}</small>
        </article>
        <article className="panel">
          <span>All tax collected</span>
          <b>{money(allTax)}</b>
          <small>{taxable.length} taxable receipts</small>
        </article>
      </div>
      <section className="panel tax-history">
        <div className="section-heading">
          <div>
            <h2>Tax receipt history</h2>
            <p className="muted">Saved tax values from completed payments.</p>
          </div>
          <button
            className="secondary"
            disabled={loading || busy}
            onClick={() => {
              setLoading(true);
              void load()
                .catch((e) => setError(e.message))
                .finally(() => setLoading(false));
            }}
          >
            Refresh
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Date</th>
                <th>Payment</th>
                <th>Subtotal</th>
                <th>Discount</th>
                <th>Tax rate</th>
                <th>Tax</th>
                <th>Total paid</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((s) => (
                <tr key={s.id}>
                  <td>#{String(s.id).padStart(5, '0')}</td>
                  <td>
                    {new Date(
                      s.created_at.includes('T')
                        ? s.created_at
                        : s.created_at.replace(' ', 'T') + 'Z',
                    ).toLocaleString('en-GB', { timeZone: 'Asia/Yangon' })}
                  </td>
                  <td>{s.payment_method.replace('_', ' ')}</td>
                  <td>{money(s.subtotal_cents)}</td>
                  <td>−{money(s.discount_cents)}</td>
                  <td>{Number(s.tax_percent)}%</td>
                  <td className="tax-amount">{money(s.tax_cents)}</td>
                  <td>
                    <b>{money(s.total_cents)}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && !taxable.length && (
          <p className="empty">
            No tax has been collected yet. Set a tax rate to apply it to new payments.
          </p>
        )}
        {taxable.length > 0 && (
          <nav className="order-pagination" aria-label="Tax receipt pages">
            <span>
              Showing {(current - 1) * 10 + 1}–{Math.min(current * 10, taxable.length)} of{' '}
              {taxable.length}
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
