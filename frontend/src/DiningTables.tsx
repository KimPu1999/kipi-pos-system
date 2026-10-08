import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from './api';
type Table = {
  id: number;
  area: string;
  name: string;
  seats: number;
  status: 'available' | 'occupied' | 'reserved';
};
export default function DiningTables() {
  const editSection = useRef<HTMLDetailsElement>(null);
  const [tables, setTables] = useState<Table[]>([]),
    [editing, setEditing] = useState<Table | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [count, setCount] = useState(15),
    [seats, setSeats] = useState(4),
    [notice, setNotice] = useState(''),
    [customArea, setCustomArea] = useState(''),
    [areaFilter, setAreaFilter] = useState(''),
    [editingArea, setEditingArea] = useState(''),
    [areaName, setAreaName] = useState(''),
    [deletingArea, setDeletingArea] = useState(''),
    [moveTo, setMoveTo] = useState('');
  const existingAreas = [...new Set(tables.map((t) => t.area))];
  const chosenArea = customArea.trim();
  const areaFields = (
    <div className="purchase-fields">
      <label>
        Area name
        <input
          value={customArea}
          required
          maxLength={100}
          disabled={busy || loading}
          placeholder="Enter your area name"
          onChange={(e) => setCustomArea(e.target.value)}
        />
      </label>
    </div>
  );
  async function load() {
    setTables(await api<Table[]>('/dining-tables'));
  }
  useEffect(() => {
    void load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!editing) return;
    editSection.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const timer = window.setTimeout(
      () => editSection.current?.querySelector<HTMLInputElement>('input[name="name"]')?.focus(),
      350,
    );
    return () => window.clearTimeout(timer);
  }, [editing]);
  async function action(task: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await task();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save table.');
    } finally {
      setBusy(false);
    }
  }
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      d = new FormData(form);
    void action(async () => {
      await api(editing ? `/dining-tables/${editing.id}` : '/dining-tables', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify({
          name: d.get('name'),
          seats: Number(d.get('seats')),
          status: d.get('status'),
          area: chosenArea,
        }),
      });
      setAreaFilter(chosenArea);
      setEditing(null);
      form.reset();
    });
  }
  return (
    <section className="purchase-workspace">
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <details className="panel table-add-options" open>
        <summary>Bulk add tables · up to 100</summary>
        <h2>Quick add tables</h2>
        <p className="muted">
          Creates available tables with automatic numbering. Existing table names are skipped.
        </p>
        {notice && (
          <p className="success" role="status">
            {notice}
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action(async () => {
              const result = await api<{ created: number }>('/dining-tables/bulk', {
                method: 'POST',
                body: JSON.stringify({ count, seats, area: chosenArea }),
              });
              setAreaFilter(chosenArea);
              setNotice(`${result.created} tables added.`);
            });
          }}
        >
          {areaFields}
          <div className="purchase-fields">
            <label>
              Number of new tables
              <input
                type="number"
                min={1}
                max={100}
                step={1}
                required
                disabled={busy || loading}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              />
            </label>
            <label>
              Seats per table
              <input
                type="number"
                min={1}
                max={100}
                step={1}
                required
                disabled={busy || loading}
                value={seats}
                onChange={(e) => setSeats(Number(e.target.value))}
              />
            </label>
          </div>
          <div className="table-count-choices" role="group" aria-label="Quick table count">
            <span>Number of tables</span>
            {[1, 5, 10, 15, 20].map((amount) => (
              <button
                type="button"
                key={amount}
                className={count === amount ? 'selected' : ''}
                aria-pressed={count === amount}
                disabled={busy || loading}
                onClick={() => setCount(amount)}
              >
                {amount}
              </button>
            ))}
            <span>or enter a custom number above</span>
          </div>
          <div className="seat-size-choices" role="group" aria-label="Quick seat size">
            <span>Seats per table</span>
            {[2, 4, 6, 8, 10].map((size) => (
              <button
                type="button"
                key={size}
                className={seats === size ? 'selected' : ''}
                aria-pressed={seats === size}
                disabled={busy || loading}
                onClick={() => setSeats(size)}
              >
                {size}
              </button>
            ))}
            <span>or enter any size above</span>
          </div>
          <div className="order-actions">
            <button className="primary" disabled={busy || loading}>
              Add tables
            </button>
            <button
              type="button"
              disabled={busy || loading || !chosenArea}
              onClick={() =>
                void action(async () => {
                  const result = await api<{ created: number }>('/dining-tables/bulk', {
                    method: 'POST',
                    body: JSON.stringify({ count: 15, seats, area: chosenArea }),
                  });
                  setAreaFilter(chosenArea);
                  setNotice(`${result.created} example tables added.`);
                })
              }
            >
              Add 15 example tables
            </button>
            <button type="button" disabled={busy || loading} onClick={() => setCount(100)}>
              Set count to 100
            </button>
          </div>
        </form>
      </details>
      <details
        ref={editSection}
        className="panel table-add-options table-edit-section"
        key={editing?.id ?? 'new'}
        open={editing ? true : undefined}
      >
        <summary>{editing ? `Edit ${editing.name}` : 'Add a single table'}</summary>
        <form onSubmit={save}>
          <h2>{editing ? 'Edit dining table' : 'Add dining table'}</h2>
          <fieldset disabled={busy || loading}>
            {areaFields}
            <div className="purchase-fields">
              <label>
                Table name / number
                <input
                  name="name"
                  required
                  maxLength={60}
                  placeholder="Table 01"
                  defaultValue={editing?.name}
                />
              </label>
              <label>
                Seats
                <input
                  name="seats"
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  required
                  defaultValue={editing?.seats ?? 4}
                />
              </label>
              <label>
                Status
                <select name="status" defaultValue={editing?.status ?? 'available'}>
                  <option value="available">Available</option>
                  <option value="occupied">Occupied</option>
                  <option value="reserved">Reserved</option>
                </select>
              </label>
            </div>
            <button className="primary">
              {busy ? 'Saving…' : editing ? 'Save table' : 'Add table'}
            </button>
            {editing && (
              <button type="button" onClick={() => setEditing(null)}>
                Cancel
              </button>
            )}
          </fieldset>
        </form>
      </details>
      <section className="panel">
        <div className="section-heading">
          <h2>Dining room{areaFilter ? ` · ${areaFilter}` : ''}</h2>
          <button disabled={busy} onClick={() => void action(load)}>
            Refresh
          </button>
        </div>
        <p className="muted">
          Manage seating availability manually. Table status is independent of orders.
        </p>
        <div className="product-summary">
          {(['available', 'occupied', 'reserved'] as const).map((status) => (
            <div key={status}>
              {status}
              <b>
                {
                  tables.filter(
                    (t) => (!areaFilter || t.area === areaFilter) && t.status === status,
                  ).length
                }
              </b>
            </div>
          ))}
        </div>
        {loading && <p role="status">Loading tables…</p>}
        <div className="categories">
          {existingAreas.map((a) => (
            <button
              key={a}
              className={areaFilter === a ? 'selected' : ''}
              aria-pressed={areaFilter === a}
              onClick={() => setAreaFilter(a)}
            >
              {a}
            </button>
          ))}
        </div>
        {!areaFilter && (
          <p className="empty">
            Create tables with an area name above, then select that area to view its tables.
          </p>
        )}
        {areaFilter && (
          <p className="muted">
            {tables.filter((t) => t.area === areaFilter).length} tables in {areaFilter}
          </p>
        )}
        {areaFilter && (
          <div className="order-actions">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setEditingArea(areaFilter);
                setAreaName(areaFilter);
                setDeletingArea('');
              }}
            >
              Edit selected area
            </button>
            <button
              type="button"
              disabled={busy || existingAreas.length < 2}
              onClick={() => {
                setDeletingArea(areaFilter);
                setMoveTo(existingAreas.find((a) => a !== areaFilter) || '');
                setEditingArea('');
              }}
            >
              Delete selected area
            </button>
          </div>
        )}
        {editingArea && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action(async () => {
                await api('/table-areas', {
                  method: 'PUT',
                  body: JSON.stringify({ area: editingArea, name: areaName.trim() }),
                });
                setEditingArea('');
                setAreaFilter(areaName.trim());
                setNotice('Area renamed.');
              });
            }}
          >
            <label>
              Area name
              <input
                required
                maxLength={100}
                value={areaName}
                disabled={busy}
                onChange={(e) => setAreaName(e.target.value)}
              />
            </label>
            <button className="primary" disabled={busy || !areaName.trim()}>
              Save area
            </button>
            <button type="button" disabled={busy} onClick={() => setEditingArea('')}>
              Cancel
            </button>
          </form>
        )}
        {deletingArea && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!window.confirm(`Remove ${deletingArea} and move its tables to ${moveTo}?`))
                return;
              void action(async () => {
                await api('/table-areas', {
                  method: 'DELETE',
                  body: JSON.stringify({ area: deletingArea, move_to: moveTo }),
                });
                setDeletingArea('');
                setAreaFilter(moveTo);
                setNotice('Area removed; tables moved to the selected area.');
              });
            }}
          >
            <p>Delete {deletingArea}. Tables and their statuses will be preserved.</p>
            <label>
              Move tables to
              <select
                value={moveTo}
                disabled={busy}
                required
                onChange={(e) => setMoveTo(e.target.value)}
              >
                {existingAreas
                  .filter((a) => a !== deletingArea)
                  .map((a) => (
                    <option key={a}>{a}</option>
                  ))}
              </select>
            </label>
            <button className="primary" disabled={busy || !moveTo}>
              Move tables & delete area
            </button>
            <button type="button" disabled={busy} onClick={() => setDeletingArea('')}>
              Cancel
            </button>
          </form>
        )}
        <div className="dining-table-grid">
          {tables
            .filter((t) => t.area === areaFilter)
            .map((t) => (
              <article className={`dining-table-card table-${t.status}`} key={t.id}>
                <h3>{t.name}</h3>
                <p>
                  {t.area} · {t.seats} seats
                </p>
                <span className={`table-status table-status-${t.status}`}>{t.status}</span>
                <label>
                  Status
                  <select
                    disabled={busy}
                    value={t.status}
                    onChange={(e) =>
                      void action(() =>
                        api(`/dining-tables/${t.id}`, {
                          method: 'PUT',
                          body: JSON.stringify({ ...t, status: e.target.value }),
                        }),
                      )
                    }
                  >
                    <option value="available">Available</option>
                    <option value="occupied">Occupied</option>
                    <option value="reserved">Reserved</option>
                  </select>
                </label>
                <div className="order-actions">
                  <button
                    disabled={busy}
                    onClick={() => {
                      setEditing(t);
                      setCustomArea(t.area);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    disabled={busy || t.status !== 'available'}
                    onClick={() => {
                      if (window.confirm(`Delete ${t.name}?`))
                        void action(() => api(`/dining-tables/${t.id}`, { method: 'DELETE' }));
                    }}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
        </div>
        {!loading && !tables.length && <p className="empty">Add your first table above.</p>}
      </section>
    </section>
  );
}
