import { useEffect, useState } from 'react';
type Table = {
  id: number;
  name: string;
  seats: number;
  area: string;
  status: 'available' | 'occupied' | 'reserved';
};
export default function TableChoice({
  tables,
  tableId,
  onChange,
  disabled = false,
}: {
  tables: Table[];
  tableId: number | null;
  onChange: (id: number | null) => void;
  disabled?: boolean;
}) {
  const [area, setArea] = useState('');
  const selected = tables.find((table) => table.id === tableId);
  const areas = [...new Set(tables.map((table) => table.area))];
  const currentArea = selected?.area ?? (areas.includes(area) ? area : (areas[0] ?? ''));
  useEffect(() => {
    if (!areas.length) {
      setArea('');
      onChange(null);
      return;
    }
    if (!areas.includes(area)) setArea(selected?.area ?? areas[0]);
    if (tableId && !selected) onChange(null);
  }, [area, areas.join('|'), onChange, selected, tableId]);
  return (
    <fieldset className="table-choice" disabled={disabled}>
      <legend>Dining location & table</legend>
      <p className="muted">
        Choose one green available table. Occupied and reserved tables cannot be selected.
      </p>
      <div className="table-choice-key" aria-label="Table status colors">
        <span className="is-available">Available</span>
        <span className="is-occupied">Occupied</span>
        <span className="is-reserved">Reserved</span>
      </div>
      {areas.length > 1 && (
        <div className="categories" role="group" aria-label="Dining location">
          {areas.map((name) => (
            <button
              type="button"
              key={name}
              className={currentArea === name ? 'selected' : ''}
              aria-pressed={currentArea === name}
              onClick={() => {
                setArea(name);
                onChange(null);
              }}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      {currentArea && (
        <div className="table-choice-grid" role="group" aria-label="Dining tables">
          {tables
            .filter((table) => table.area === currentArea)
            .map((table) => {
              const available = table.status === 'available',
                chosen = tableId === table.id;
              return (
                <button
                  type="button"
                  key={table.id}
                  className={`table-choice-button table-choice-${table.status}${chosen ? ' selected' : ''}`}
                  aria-pressed={chosen}
                  aria-label={`${table.name}, ${table.seats} seats, ${table.status}`}
                  disabled={disabled || !available}
                  onClick={() => onChange(chosen ? null : table.id)}
                >
                  <strong>{table.name}</strong>
                  <span>{table.seats} seats</span>
                  <small>{table.status}</small>
                </button>
              );
            })}
        </div>
      )}
      {selected ? (
        <p className="table-choice-selection" role="status">
          Selected: <strong>{selected.name}</strong> · {selected.seats} seats
        </p>
      ) : (
        <p role="status" className="muted">
          {tables.some((table) => table.status === 'available')
            ? 'Select one available table before placing your order.'
            : 'No tables are currently available. Ask staff for assistance.'}
        </p>
      )}
    </fieldset>
  );
}
