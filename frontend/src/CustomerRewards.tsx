import { useEffect, useState } from 'react';
import { api } from './api';
type Rewards = {
  points: number;
  purchases_count: number;
  spent_cents: number;
  rule: string;
  history: {
    id: number;
    created_at: string;
    total_cents: number;
    points: number;
    items: { id: number; name: string; quantity: number; price_cents: number }[];
  }[];
};
const money = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'MMK',
    currencyDisplay: 'code',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n / 100);
export default function CustomerRewards({ customerId }: { customerId?: number }) {
  const [data, setData] = useState<Rewards | null>(null),
    [error, setError] = useState(''),
    [reload, setReload] = useState(0),
    [page, setPage] = useState(1);
  useEffect(() => {
    let current = true;
    setData(null);
    setError('');
    setPage(1);
    void api<Rewards>(`/customer/rewards${customerId ? `?customer_id=${customerId}` : ''}`)
      .then((d) => {
        if (current) setData(d);
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [customerId, reload]);
  const pages = Math.max(1, Math.ceil((data?.history.length || 0) / 10));
  const currentPage = Math.min(page, pages);
  const visibleHistory = data?.history.slice((currentPage - 1) * 10, currentPage * 10) || [];
  return (
    <section className="purchase-workspace">
      <div className="panel">
        <div className="section-heading">
          <h2>Customer points & buying history</h2>
          <button className="secondary" onClick={() => setReload((n) => n + 1)}>
            Refresh points
          </button>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {!data && !error && <p role="status">Loading purchase history…</p>}
        {data && (
          <>
            <div className="product-summary">
              <div>
                Points earned <b>{data.points}</b>
              </div>
              <div>
                Paid purchases <b>{data.purchases_count}</b>
              </div>
              <div>
                Total spent <b>{money(data.spent_cents)}</b>
              </div>
            </div>
            <p className="muted">{data.rule} Points are recorded when payment is completed.</p>
          </>
        )}
      </div>
      {data && (
        <section className="panel">
          <h2>Items you bought</h2>
          <p className="muted">
            Latest 200 paid purchases. Item prices are before order discounts; paid totals include
            discounts.
          </p>
          {visibleHistory.map((p) => (
            <details className="purchase-record" key={p.id}>
              <summary>
                <strong>
                  Receipt #{p.id} · {money(p.total_cents)}
                </strong>
                <span>
                  {new Date(p.created_at).toLocaleString()} · +{p.points} points
                </span>
              </summary>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Quantity</th>
                      <th>Unit price</th>
                      <th>Item total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.items.map((i) => (
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
            </details>
          ))}
          {!data.history.length && (
            <p className="empty">
              Your paid purchases and points will appear here after payment is completed.
            </p>
          )}
          {data.history.length > 0 && (
            <nav className="order-pagination" aria-label="Points and purchase history pages">
              <span>
                Showing {(currentPage - 1) * 10 + 1}–
                {Math.min(currentPage * 10, data.history.length)} of {data.history.length}
              </span>
              <button
                className="secondary"
                disabled={currentPage === 1}
                onClick={() => setPage(currentPage - 1)}
              >
                Previous
              </button>
              {Array.from({ length: pages }, (_, index) => index + 1).map((number) => (
                <button
                  key={number}
                  className={currentPage === number ? 'selected' : ''}
                  aria-current={currentPage === number ? 'page' : undefined}
                  onClick={() => setPage(number)}
                >
                  {number}
                </button>
              ))}
              <button
                className="secondary"
                disabled={currentPage === pages}
                onClick={() => setPage(currentPage + 1)}
              >
                Next
              </button>
            </nav>
          )}
        </section>
      )}
    </section>
  );
}
