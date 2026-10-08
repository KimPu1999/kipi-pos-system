import { useEffect, useState } from 'react';
import { api } from './api';
type Report = {
  timezone: string;
  summary: {
    net_cents: number;
    gross_cents: number;
    discount_cents: number;
    tax_cents: number;
    sales_count: number;
    quantity: number;
  };
  items: { product_id: number; name: string; quantity: number; gross_cents: number }[];
  buckets: { label: string; sales_count: number; net_cents: number }[];
  inventory: {
    id: number;
    name: string;
    sku: string;
    active: boolean;
    available: number;
    reserved: number;
    price_cents: number;
    available_value_cents: number;
  }[];
  inventory_summary: { available_units: number; reserved_units: number; value_cents: number };
};
const money = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'MMK',
    currencyDisplay: 'code',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n / 100);
const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Yangon',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());
export default function Reports() {
  const [period, setPeriod] = useState<'day' | 'month' | 'year'>('day'),
    [date, setDate] = useState(today),
    [data, setData] = useState<Report | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false),
    [reload, setReload] = useState(0);
  const [exportRange, setExportRange] = useState('30days'),
    [exportMonth, setExportMonth] = useState(today.slice(0, 7)),
    [exporting, setExporting] = useState(false);
  async function downloadExcel() {
    setExporting(true);
    setError('');
    try {
      const response = await fetch(
        `/api/admin/export?range=${exportRange}${exportRange === 'month' ? `&month=${exportMonth}` : ''}`,
        { credentials: 'same-origin' },
      );
      if (!response.ok) {
        if (response.status === 401) window.dispatchEvent(new Event('auth-expired'));
        const body = await response.json();
        throw new Error(body.message || 'Unable to export records.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `kipi-pos-${exportRange}-${exportRange === 'month' ? exportMonth : today}.xlsx`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to download Excel.');
    } finally {
      setExporting(false);
    }
  }
  const [itemPage, setItemPage] = useState(1),
    [inventoryPage, setInventoryPage] = useState(1);
  const inventoryPages = Math.max(1, Math.ceil((data?.inventory.length ?? 0) / 10));
  const currentInventoryPage = Math.min(inventoryPage, inventoryPages);
  const itemPages = Math.max(1, Math.ceil((data?.items.length ?? 0) / 10));
  const currentItemPage = Math.min(itemPage, itemPages);
  useEffect(() => setItemPage(1), [period, date]);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    setData(null);
    void api<Report>(`/admin/reports?period=${period}&date=${date}`)
      .then((r) => {
        if (current) setData(r);
      })
      .catch((e) => {
        if (current) setError(e.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [period, date, reload]);
  return (
    <section className="reports-workspace">
      <section className="panel report-export">
        <h2>Excel archive</h2>
        <p>
          Download orders, bills, receipts, purchases and current inventory. Your records stay in
          the database.
        </p>
        <div className="report-export-controls">
          <label>
            Export period
            <select
              value={exportRange}
              disabled={exporting}
              onChange={(e) => setExportRange(e.target.value)}
            >
              <option value="30days">Last 30 days</option>
              <option value="month">Selected month</option>
              <option value="older">Older than the last 30 days</option>
              <option value="all">All dates</option>
            </select>
          </label>
          {exportRange === 'month' && (
            <label>
              Month
              <input
                type="month"
                required
                value={exportMonth}
                disabled={exporting}
                onChange={(e) => setExportMonth(e.target.value)}
              />
            </label>
          )}
          <button
            type="button"
            className="primary"
            disabled={exporting || (exportRange === 'month' && !exportMonth)}
            onClick={() => void downloadExcel()}
          >
            {exporting ? 'Preparing Excel…' : 'Download Excel'}
          </button>
        </div>
      </section>
      <div className="panel report-controls">
        <div>
          <h2>Sales & inventory reports</h2>
          <p>Paid sales by day, month or year · Myanmar time (UTC+6:30)</p>
        </div>
        <div className="report-periods">
          {(['day', 'month', 'year'] as const).map((p) => (
            <button
              type="button"
              aria-pressed={period === p}
              className={period === p ? 'selected' : ''}
              key={p}
              onClick={() => setPeriod(p)}
            >
              {p === 'day' ? 'Daily' : p === 'month' ? 'Monthly' : 'Yearly'}
            </button>
          ))}
        </div>
        <label>
          {period === 'day' ? 'Day' : period === 'month' ? 'Month' : 'Year'}
          <input
            type={period === 'day' ? 'date' : period === 'month' ? 'month' : 'number'}
            value={
              period === 'day' ? date : period === 'month' ? date.slice(0, 7) : date.slice(0, 4)
            }
            min={period === 'year' ? '2000' : undefined}
            max={period === 'year' ? '2100' : undefined}
            onChange={(e) => {
              const v = e.target.value;
              if (period === 'year') {
                if (/^\d{4}$/.test(v) && Number(v) >= 2000 && Number(v) <= 2100)
                  setDate(`${v}-01-01`);
              } else if (v) setDate(period === 'month' ? `${v}-01` : v);
            }}
          />
        </label>
        <button className="secondary" disabled={loading} onClick={() => setReload((n) => n + 1)}>
          Refresh report
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {loading && (
        <p role="status" className="empty">
          Loading report…
        </p>
      )}
      {data && (
        <>
          <div className="report-metrics">
            {[
              ['Net sales', money(data.summary.net_cents)],
              ['Items sold', data.summary.quantity],
              ['Transactions', data.summary.sales_count],
              ['Discounts', money(data.summary.discount_cents)],
              ['Tax collected', money(data.summary.tax_cents)],
            ].map(([label, value]) => (
              <div className="panel" key={label}>
                <span>{label}</span>
                <h2>{value}</h2>
              </div>
            ))}
          </div>
          <section className="panel">
            <div className="section-heading">
              <h2>Sales over time</h2>
              <span className="muted">Net paid amount</span>
            </div>
            <div
              className="report-chart"
              role="img"
              aria-label={data.buckets.map((b) => `${b.label}: ${money(b.net_cents)}`).join('; ')}
            >
              {data.buckets.map((b) => (
                <div
                  className="report-chart-column"
                  key={b.label}
                  title={`${b.label}: ${money(b.net_cents)} · ${b.sales_count} sales`}
                >
                  <span>{money(b.net_cents)}</span>
                  <div>
                    <i
                      style={{
                        height: `${(b.net_cents / Math.max(1, ...data.buckets.map((x) => x.net_cents))) * 100}%`,
                      }}
                    />
                  </div>
                  <small>
                    {period === 'day'
                      ? b.label
                      : period === 'month'
                        ? b.label.slice(-2)
                        : b.label.slice(-2)}
                  </small>
                </div>
              ))}
            </div>
          </section>
          <section className="panel report-table">
            <h2>Items sold — selected period</h2>
            <p className="muted">
              Item amounts are before order discounts. Total gross:{' '}
              {money(data.summary.gross_cents)}.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Quantity sold</th>
                    <th>Gross amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.slice((currentItemPage - 1) * 10, currentItemPage * 10).map((i) => (
                    <tr key={i.product_id}>
                      <td>{i.name}</td>
                      <td>{i.quantity}</td>
                      <td>{money(i.gross_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.items.length > 0 && (
              <nav className="order-pagination" aria-label="Report item pages">
                <span>
                  Showing {(currentItemPage - 1) * 10 + 1}–
                  {Math.min(currentItemPage * 10, data.items.length)} of {data.items.length} items
                </span>
                <button
                  disabled={currentItemPage === 1}
                  onClick={() => setItemPage(currentItemPage - 1)}
                >
                  Previous
                </button>
                {Array.from({ length: itemPages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    className={currentItemPage === n ? 'selected' : ''}
                    aria-current={currentItemPage === n ? 'page' : undefined}
                    onClick={() => setItemPage(n)}
                  >
                    {n}
                  </button>
                ))}
                <button
                  disabled={currentItemPage === itemPages}
                  onClick={() => setItemPage(currentItemPage + 1)}
                >
                  Next
                </button>
              </nav>
            )}
            {!data.items.length && <p className="empty">No paid sales in this period.</p>}
          </section>
          <section className="panel report-table">
            <h2>Current inventory</h2>
            <p className="muted">
              Current stock, independent of the selected sales period. Values use selling prices,
              not cost or profit.
            </p>
            <div className="product-summary">
              <div>
                Available units <b>{data.inventory_summary.available_units}</b>
              </div>
              <div>
                Reserved units <b>{data.inventory_summary.reserved_units}</b>
              </div>
              <div>
                Available stock value <b>{money(data.inventory_summary.value_cents)}</b>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Item / SKU</th>
                    <th>Status</th>
                    <th>Available</th>
                    <th>Reserved</th>
                    <th>Unit price</th>
                    <th>Available value</th>
                  </tr>
                </thead>
                <tbody>
                  {data.inventory
                    .slice((currentInventoryPage - 1) * 10, currentInventoryPage * 10)
                    .map((i) => (
                      <tr key={i.id}>
                        <td>
                          {i.name}
                          <small className="report-sku">{i.sku}</small>
                        </td>
                        <td>{i.active ? 'Active' : 'Inactive'}</td>
                        <td>{i.available}</td>
                        <td>{i.reserved}</td>
                        <td>{money(i.price_cents)}</td>
                        <td>{money(i.available_value_cents)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {data.inventory.length > 0 && (
              <nav className="order-pagination" aria-label="Current inventory pages">
                <span>
                  Showing {(currentInventoryPage - 1) * 10 + 1}–
                  {Math.min(currentInventoryPage * 10, data.inventory.length)} of{' '}
                  {data.inventory.length} items
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
        </>
      )}
    </section>
  );
}
