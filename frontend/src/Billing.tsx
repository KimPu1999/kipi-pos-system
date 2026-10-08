import { useEffect, useRef, useState } from 'react';
import { api } from './api';
type Bill = {
  id: number;
  order_id: number | null;
  transfer_provider: 'kbzpay' | 'ayapay' | null;
  driver_name: string | null;
  driver_phone: string | null;
  delivery_location: string | null;
  delivery_eta: string | null;
  delivered_at: string | null;
  cardholder_name: string | null;
  card_last_four: string | null;
  service_type: string;
  table_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  phone: string | null;
  location: string | null;
  zip_code: string | null;
  created_at: string;
  payment_method: string;
  total_cents: number;
  subtotal_cents: number | null;
  discount_cents: number | null;
  tax_percent: number;
  tax_cents: number;
  redeemed_points: number;
  point_discount_cents: number;
  promotion_code: string | null;
  amount_received_cents: number | null;
  change_cents: number;
  items: { id: number; name: string; quantity: number; price_cents: number }[];
};
const money = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'MMK',
    currencyDisplay: 'code',
    maximumFractionDigits: 2,
  }).format(n / 100);
export default function Billing({
  receiptId,
  onDone,
}: { receiptId?: number; onDone?: () => void } = {}) {
  const [bills, setBills] = useState<Bill[]>([]),
    [selected, setSelected] = useState<Bill | null>(null),
    [search, setSearch] = useState(''),
    [page, setPage] = useState(1),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [reload, setReload] = useState(0);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    void api<Bill[]>('/sales')
      .then((d) => {
        if (current) {
          setBills(d);
          if (receiptId) setSelected(d.find((b) => b.id === receiptId) ?? null);
        }
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
  }, [reload, receiptId]);
  const billDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (selected) billDialog.current?.showModal();
    else billDialog.current?.close();
  }, [selected]);
  const billDate = (value: string) =>
    new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z').toLocaleString('en-GB', {
      timeZone: 'Asia/Yangon',
    });
  const paymentLabel = (bill: Bill) =>
    bill.payment_method === 'bank_transfer'
      ? bill.transfer_provider === 'ayapay'
        ? 'AYA Pay'
        : 'KBZPay'
      : bill.payment_method === 'card'
        ? 'Card'
        : 'Cash';
  const visible = bills.filter((b) =>
    `${b.id} ${paymentLabel(b)} ${b.items.map((i) => i.name).join(' ')}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(visible.length / 10)),
    current = Math.min(page, pages),
    shown = visible.slice((current - 1) * 10, current * 10);
  useEffect(() => setPage(1), [search]);
  return (
    <section className={receiptId ? 'billing-workspace order-paid-receipt' : 'billing-workspace'}>
      <section className="panel billing-list" hidden={!!receiptId}>
        <div className="section-heading">
          <div>
            <h2>Paid bills</h2>
            <p className="muted">POS sales and completed customer orders.</p>
          </div>
          <button className="secondary" disabled={loading} onClick={() => setReload((n) => n + 1)}>
            Refresh bills
          </button>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="product-summary">
          <div>
            Paid bills <b>{bills.length}</b>
          </div>
          <div>
            Paid amount <b>{money(bills.reduce((n, b) => n + b.total_cents, 0))}</b>
          </div>
        </div>
        <label>
          Search bills
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Receipt number, item or payment method"
          />
        </label>
        {loading && <p role="status">Loading bills…</p>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Bill</th>
                <th>Date</th>
                <th>Payment</th>
                <th>Amount</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((b) => (
                <tr key={b.id}>
                  <td>#{String(b.id).padStart(5, '0')}</td>
                  <td>{billDate(b.created_at)}</td>
                  <td>{paymentLabel(b)}</td>
                  <td>{money(b.total_cents)}</td>
                  <td>
                    <button onClick={() => setSelected(b)}>View bill</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visible.length > 10 && (
          <nav className="order-pagination" aria-label="Billing pages">
            <span>
              Showing {(current - 1) * 10 + 1}–{Math.min(current * 10, visible.length)} of{' '}
              {visible.length} bills
            </span>
            <button
              className="secondary"
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
            >
              Previous
            </button>
            {Array.from({ length: pages }, (_, i) => i + 1).map((number) => (
              <button
                key={number}
                className={current === number ? 'selected' : ''}
                aria-current={current === number ? 'page' : undefined}
                onClick={() => setPage(number)}
              >
                {number}
              </button>
            ))}
            <button
              className="secondary"
              disabled={current === pages}
              onClick={() => setPage(current + 1)}
            >
              Next
            </button>
          </nav>
        )}
        {!loading && !visible.length && <p className="empty">No matching paid bills.</p>}
      </section>
      <dialog
        ref={billDialog}
        className="billing-dialog"
        aria-labelledby="bill-view-title"
        onCancel={() => {
          setSelected(null);
          onDone?.();
        }}
        onClose={() => {
          setSelected(null);
          onDone?.();
        }}
      >
        {selected && (
          <section className="panel billing-receipt">
            <div className="section-heading">
              <div>
                <span className="bill-paid-badge">PAID</span>
                <h2 id="bill-view-title">Kipi POS · Payment receipt</h2>
              </div>
              <button
                onClick={() => {
                  setSelected(null);
                  onDone?.();
                }}
              >
                Close
              </button>
            </div>
            <p className="muted">{billDate(selected.created_at)} · Myanmar time</p>
            <p>
              Receipt #{String(selected.id).padStart(5, '0')} ·{' '}
              {paymentLabel(selected).toUpperCase()}
            </p>
            {selected.payment_method === 'card' && (
              <p>
                {selected.cardholder_name}
                {selected.card_last_four ? ` · Card ending ${selected.card_last_four}` : ''}
              </p>
            )}
            <p>
              {selected.service_type === 'dine_in'
                ? `Dine in · ${selected.table_name || 'Table not specified'}`
                : 'Takeaway'}
            </p>
            {selected.service_type === 'takeaway' && selected.contact_name && (
              <div className="order-contact-summary">
                <p>
                  <strong>Delivered to</strong>
                </p>
                <p>
                  {selected.contact_name} · {selected.contact_email}
                </p>
                <p>{selected.phone}</p>
                <p>
                  {selected.location} · {selected.zip_code}
                </p>
              </div>
            )}
            {selected.delivered_at && (
              <div className="billing-delivery-proof">
                <strong>Delivery confirmed</strong>
                <span>{billDate(selected.delivered_at)}</span>
                {selected.driver_name && (
                  <span>
                    Driver: {selected.driver_name} · {selected.driver_phone}
                  </span>
                )}
                {selected.delivery_location && (
                  <span>Delivery location: {selected.delivery_location}</span>
                )}
              </div>
            )}
            {selected.payment_method === 'bank_transfer' && (
              <div className="receipt-line">
                <span>Online payment</span>
                <b>{selected.transfer_provider === 'ayapay' ? 'AYA Pay' : 'KBZPay'}</b>
              </div>
            )}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.items.map((i) => (
                    <tr key={i.id}>
                      <td>{i.name}</td>
                      <td>{i.quantity}</td>
                      <td>{money(i.price_cents)}</td>
                      <td>{money(i.quantity * i.price_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="receipt-line">
              <span>Subtotal</span>
              <b>
                {money(
                  selected.subtotal_cents ??
                    selected.items.reduce((n, i) => n + i.quantity * i.price_cents, 0),
                )}
              </b>
            </div>
            {(selected.discount_cents ?? 0) - selected.point_discount_cents > 0 && (
              <div className="receipt-line">
                <span>Discount {selected.promotion_code || ''}</span>
                <b>−{money((selected.discount_cents ?? 0) - selected.point_discount_cents)}</b>
              </div>
            )}
            {selected.redeemed_points > 0 && (
              <div className="receipt-line point-receipt-line">
                <span>Points used ({selected.redeemed_points})</span>
                <b>−{money(selected.point_discount_cents)}</b>
              </div>
            )}
            <div className="receipt-line tax-line">
              <span>Tax ({Number(selected.tax_percent)}%)</span>
              <b>{money(selected.tax_cents)}</b>
            </div>
            <div className="receipt-line">
              <strong>Total paid</strong>
              <strong>{money(selected.total_cents)}</strong>
            </div>
            {selected.amount_received_cents !== null && (
              <>
                <div className="receipt-line">
                  <span>Cash received</span>
                  <b>{money(selected.amount_received_cents)}</b>
                </div>
                <div className="receipt-line">
                  <span>Change</span>
                  <b>{money(selected.change_cents)}</b>
                </div>
              </>
            )}
            <div className="bill-thank-you">
              <strong>Thank you! Come again.</strong>
              <p>We appreciate your visit.</p>
            </div>
            <div className="billing-complete-actions">
              <button className="primary billing-print" onClick={() => window.print()}>
                Print bill
              </button>
              <button
                className="secondary billing-done"
                onClick={() => {
                  setSelected(null);
                  onDone?.();
                }}
              >
                Done
              </button>
            </div>
          </section>
        )}
      </dialog>
    </section>
  );
}
