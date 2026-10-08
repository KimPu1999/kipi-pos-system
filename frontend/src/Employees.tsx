import { useEffect, useState, type FormEvent } from 'react';
import { api } from './api';
type SalaryPayment = {
  id: number;
  cash_entry_id: number;
  amount_cents: number;
  salary_cents: number;
  bonus_cents: number;
  extra_bonus_cents: number;
  payment_method: 'cash' | 'bank_transfer' | 'card';
  paid_on: string;
  month: string;
  note: string | null;
};
type Employee = {
  id: number;
  employee_code: string;
  name: string;
  salary_cents: number;
  active: boolean | number;
  worked_minutes: number;
  checked_in_at: string | null;
  salary_payment: SalaryPayment | null;
};
type Shift = {
  id: number;
  employee_id: number;
  starts_at: string;
  ends_at: string;
  break_minutes: number;
  worked_minutes: number;
};
type Data = { employees: Employee[]; shifts: Shift[] };
const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Yangon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
const money = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'MMK',
    currencyDisplay: 'code',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n / 100);
const hours = (n: number) => `${Math.floor(n / 60)}h ${n % 60}m`;
const dateTime = (s: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Yangon',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(s));
export default function Employees({ navigate }: { navigate: (page: string) => void }) {
  const [month, setMonth] = useState(today().slice(0, 7)),
    [data, setData] = useState<Data>({ employees: [], shifts: [] }),
    [editing, setEditing] = useState<Employee | null>(null),
    [paying, setPaying] = useState<Employee | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [reload, setReload] = useState(0),
    [checkout, setCheckout] = useState<Employee | null>(null);
  useEffect(() => {
    let current = true;
    setLoading(true);
    void api<Data>(`/employees?month=${month}`)
      .then((d) => {
        if (current) setData(d);
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
  }, [month, reload]);
  async function action(task: () => Promise<unknown>, done: () => void, message: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await task();
      done();
      setNotice(message);
      setReload((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save.');
    } finally {
      setBusy(false);
    }
  }
  function saveEmployee(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      d = new FormData(form);
    void action(
      () =>
        api(editing ? `/employees/${editing.id}` : '/employees', {
          method: editing ? 'PUT' : 'POST',
          body: JSON.stringify({
            employee_code: d.get('employee_code'),
            name: d.get('name'),
            salary_cents: Math.round(Number(d.get('salary')) * 100),
            active: d.get('active') === 'on',
          }),
        }),
      () => {
        setEditing(null);
        form.reset();
      },
      'Employee saved.',
    );
  }
  function saveShift(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      d = new FormData(form);
    void action(
      () =>
        api(`/employees/${d.get('employee_id')}/shifts`, {
          method: 'POST',
          body: JSON.stringify({
            date: d.get('date'),
            start_time: d.get('start_time'),
            end_time: d.get('end_time'),
            overnight: d.get('overnight') === 'on',
            break_minutes: Number(d.get('break_minutes')),
          }),
        }),
      () => form.reset(),
      'Working hours recorded.',
    );
  }
  function paySalary(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!paying) return;
    const d = new FormData(e.currentTarget);
    const payment = paying.salary_payment;
    void action(
      () =>
        api(
          payment
            ? `/employees/${paying.id}/salary-payments/${payment.id}`
            : `/employees/${paying.id}/salary-payments`,
          {
            method: payment ? 'PUT' : 'POST',
            body: JSON.stringify({
              ...(payment ? {} : { month }),
              salary_cents: Math.round(Number(d.get('salary')) * 100),
              bonus_cents: Math.round(Number(d.get('bonus')) * 100),
              extra_bonus_cents: Math.round(Number(d.get('extra_bonus')) * 100),
              payment_method: d.get('payment_method'),
              paid_on: d.get('paid_on'),
              note: d.get('note') || null,
            }),
          },
        ),
      () => setPaying(null),
      payment
        ? 'Salary payment and linked cash out updated.'
        : 'Salary paid. Cash out was added automatically.',
    );
  }
  return (
    <section className="employee-workspace">
      {paying && (
        <form className="panel salary-payment-form" onSubmit={paySalary}>
          <h2>
            {paying.salary_payment ? 'Edit salary payment' : 'Pay salary'} · {paying.name}
          </h2>
          <p className="muted">
            {paying.salary_payment
              ? 'Changes also update the linked cash-out entry.'
              : `This records the ${month} salary and automatically adds a paid cash-out entry.`}
          </p>
          <fieldset disabled={busy}>
            <div className="salary-amount-fields">
              <label>
                Base salary (MMK)
                <input
                  name="salary"
                  type="number"
                  min={0}
                  step={1}
                  required
                  autoFocus
                  defaultValue={(paying.salary_payment?.salary_cents ?? paying.salary_cents) / 100}
                />
              </label>
              <label>
                Bonus (MMK)
                <input
                  name="bonus"
                  type="number"
                  min={0}
                  step={1}
                  required
                  defaultValue={(paying.salary_payment?.bonus_cents ?? 0) / 100}
                />
              </label>
              <label>
                Extra bonus (MMK)
                <input
                  name="extra_bonus"
                  type="number"
                  min={0}
                  step={1}
                  required
                  defaultValue={(paying.salary_payment?.extra_bonus_cents ?? 0) / 100}
                />
              </label>
              <label>
                Payment method
                <select
                  name="payment_method"
                  defaultValue={paying.salary_payment?.payment_method ?? 'cash'}
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="card">Card</option>
                </select>
              </label>
              <label>
                Paid date
                <input
                  name="paid_on"
                  type="date"
                  required
                  defaultValue={paying.salary_payment?.paid_on ?? today()}
                />
              </label>
            </div>
            <label>
              Note
              <input
                name="note"
                maxLength={2000}
                placeholder="Optional payroll note"
                defaultValue={paying.salary_payment?.note ?? ''}
              />
            </label>
            <div className="cash-form-actions">
              <button className="primary">
                {busy
                  ? 'Saving…'
                  : paying.salary_payment
                    ? 'Save payment changes'
                    : 'Confirm salary payment'}
              </button>
              <button type="button" onClick={() => setPaying(null)}>
                Cancel
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {checkout && (
        <form
          className="panel"
          onSubmit={(e) => {
            e.preventDefault();
            const d = new FormData(e.currentTarget);
            void action(
              () =>
                api(`/employees/${checkout.id}/check-out`, {
                  method: 'POST',
                  body: JSON.stringify({ break_minutes: Number(d.get('break_minutes')) }),
                }),
              () => setCheckout(null),
              'Checked out. Working hours recorded.',
            );
          }}
        >
          <h2>Check out · {checkout.name}</h2>
          <p>Checked in: {dateTime(checkout.checked_in_at!)}</p>
          <label>
            Unpaid break (minutes)
            <input name="break_minutes" type="number" required min={0} step={1} defaultValue={0} />
          </label>
          <button className="primary" disabled={busy}>
            Confirm check out
          </button>
          <button type="button" disabled={busy} onClick={() => setCheckout(null)}>
            Cancel
          </button>
        </form>
      )}
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
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Monthly working time & salary</h2>
            <p className="muted">Completed shifts for the selected month · Myanmar time.</p>
          </div>
          <label>
            Choose month
            <input
              type="month"
              value={month}
              onChange={(e) => {
                if (e.target.value) setMonth(e.target.value);
              }}
            />
          </label>
          <a
            className="secondary employee-pdf-download"
            href={`/api/employees/export-pdf?month=${month}`}
            download
          >
            Download hours & shifts PDF
          </a>
        </div>
        <div className="product-summary">
          <div>
            Total working time{' '}
            <b>{loading ? '…' : hours(data.employees.reduce((n, e) => n + e.worked_minutes, 0))}</b>
          </div>
          <div>
            Recorded shifts <b>{loading ? '…' : data.shifts.length}</b>
          </div>
          <div>
            Active monthly salaries{' '}
            <b>
              {loading
                ? '…'
                : money(
                    data.employees.filter((e) => e.active).reduce((n, e) => n + e.salary_cents, 0),
                  )}
            </b>
          </div>
          <div>
            Paid salaries · {month}{' '}
            <b>
              {loading
                ? '…'
                : money(
                    data.employees.reduce((n, e) => n + (e.salary_payment?.amount_cents ?? 0), 0),
                  )}
            </b>
          </div>
        </div>
        <p className="muted">
          Salary uses each employee’s current monthly rate and is paid once per employee each month.
          Every salary payment creates a linked cash-out record.
        </p>
      </section>
      <div className="employee-forms">
        <form className="panel" onSubmit={saveEmployee} key={editing?.id ?? 'new'}>
          <h2>{editing ? 'Edit employee' : 'Add employee'}</h2>
          <fieldset disabled={busy}>
            <label>
              Employee ID
              <input
                name="employee_code"
                required
                maxLength={50}
                defaultValue={editing?.employee_code}
                placeholder="EMP-001"
              />
            </label>
            <label>
              Full name
              <input name="name" required maxLength={150} defaultValue={editing?.name} />
            </label>
            <label>
              Monthly salary (MMK)
              <input
                name="salary"
                type="number"
                min={0}
                max={10000000}
                step="0.01"
                required
                defaultValue={editing ? editing.salary_cents / 100 : ''}
              />
            </label>
            <label className="employee-check">
              <input
                name="active"
                type="checkbox"
                defaultChecked={editing ? !!editing.active : true}
              />{' '}
              Active employee
            </label>
            <button className="primary">
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Add employee'}
            </button>
            {editing && (
              <button type="button" onClick={() => setEditing(null)}>
                Cancel edit
              </button>
            )}
          </fieldset>
        </form>
        <form className="panel" onSubmit={saveShift}>
          <h2>Record working hours</h2>
          <p className="muted">All shift dates and times use Myanmar time (UTC+6:30).</p>
          <fieldset disabled={busy || loading}>
            <label>
              Employee
              <select name="employee_id" required defaultValue="">
                <option value="">Choose employee</option>
                {data.employees
                  .filter((e) => e.active)
                  .map((e) => (
                    <option value={e.id} key={e.id}>
                      {e.employee_code} · {e.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Work date
              <input type="date" name="date" required defaultValue={today()} />
            </label>
            <div className="employee-time-fields">
              <label>
                Start time
                <input type="time" name="start_time" required />
              </label>
              <label>
                End time
                <input type="time" name="end_time" required />
              </label>
              <label>
                Break (minutes)
                <input
                  type="number"
                  name="break_minutes"
                  min={0}
                  max={1440}
                  step={1}
                  defaultValue={0}
                  required
                />
              </label>
            </div>
            <label className="employee-check">
              <input type="checkbox" name="overnight" /> Ends the next day
            </label>
            <button className="primary" disabled={!data.employees.some((e) => e.active)}>
              Save working hours
            </button>
          </fieldset>
        </form>
      </div>
      <section className="panel">
        <div className="section-heading">
          <h2>Employees & monthly hours</h2>
          <label>
            Month
            <input
              type="month"
              value={month}
              onChange={(e) => {
                if (e.target.value) setMonth(e.target.value);
              }}
            />
          </label>
          <button disabled={loading || busy} onClick={() => setReload((n) => n + 1)}>
            Refresh
          </button>
        </div>
        <p className="muted">
          Hours exclude breaks and are grouped by the shift’s starting month. Use Pay salary to
          record payroll and cash out.
        </p>
        {loading && <p role="status">Loading employees…</p>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee ID</th>
                <th>Name</th>
                <th>Monthly salary</th>
                <th>Working hours · {month}</th>
                <th>Shifts</th>
                <th>Work days</th>
                <th>Status</th>
                <th>Salary payment</th>
                <th>Attendance</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.employees.map((e) => (
                <tr key={e.id}>
                  <td>{e.employee_code}</td>
                  <td>{e.name}</td>
                  <td>{money(e.salary_cents)}</td>
                  <td>{hours(e.worked_minutes)}</td>
                  <td>{data.shifts.filter((s) => s.employee_id === e.id).length}</td>
                  <td>
                    {
                      new Set(
                        data.shifts
                          .filter((s) => s.employee_id === e.id)
                          .map((s) =>
                            new Intl.DateTimeFormat('en-CA', {
                              timeZone: 'Asia/Yangon',
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                            }).format(new Date(s.starts_at)),
                          ),
                      ).size
                    }
                  </td>
                  <td>{e.active ? 'Active' : 'Inactive'}</td>
                  <td>
                    {e.salary_payment ? (
                      <>
                        <span className="cash-payment cash-payment-paid">Paid</span>
                        <small className="cash-entry-note">
                          {e.salary_payment.paid_on} · Total {money(e.salary_payment.amount_cents)}{' '}
                          · {e.salary_payment.payment_method.replace('_', ' ')}
                        </small>
                        <small className="cash-entry-note">
                          Salary {money(e.salary_payment.salary_cents)} · Bonus{' '}
                          {money(e.salary_payment.bonus_cents)} · Extra{' '}
                          {money(e.salary_payment.extra_bonus_cents)}
                        </small>
                        <button
                          className="cash-edit employee-payment-edit"
                          disabled={busy}
                          onClick={() => {
                            setPaying(e);
                            requestAnimationFrame(() =>
                              requestAnimationFrame(() =>
                                document
                                  .querySelector<HTMLElement>('.salary-payment-form')
                                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
                              ),
                            );
                          }}
                        >
                          Edit payment
                        </button>
                        <button
                          className="employee-cash-link"
                          onClick={() => {
                            sessionStorage.setItem(
                              'kipiCashFocus',
                              String(e.salary_payment!.cash_entry_id),
                            );
                            navigate('cashbook');
                          }}
                        >
                          View cash out
                        </button>
                      </>
                    ) : (
                      <button
                        className="cash-pay"
                        disabled={busy}
                        onClick={() => {
                          setPaying(e);
                          requestAnimationFrame(() =>
                            requestAnimationFrame(() =>
                              document
                                .querySelector<HTMLElement>('.salary-payment-form')
                                ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
                            ),
                          );
                        }}
                      >
                        Pay salary
                      </button>
                    )}
                  </td>
                  <td>
                    {e.checked_in_at ? (
                      <>
                        <small>In: {dateTime(e.checked_in_at)}</small>
                        <button disabled={busy || loading} onClick={() => setCheckout(e)}>
                          Check out
                        </button>
                      </>
                    ) : (
                      <button
                        disabled={busy || loading || !e.active}
                        onClick={() =>
                          void action(
                            () => api(`/employees/${e.id}/check-in`, { method: 'POST' }),
                            () => {},
                            'Employee checked in.',
                          )
                        }
                      >
                        Check in
                      </button>
                    )}
                  </td>
                  <td>
                    <button
                      disabled={busy}
                      onClick={() => {
                        setEditing(e);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && !data.employees.length && (
          <p className="empty">Add your first employee above.</p>
        )}
      </section>
      <section className="panel">
        <h2>Shift history · {month}</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Start date & time</th>
                <th>End date & time</th>
                <th>Break</th>
                <th>Working hours</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.shifts.map((s) => (
                <tr key={s.id}>
                  <td>{data.employees.find((e) => e.id === s.employee_id)?.name}</td>
                  <td>{dateTime(s.starts_at)}</td>
                  <td>{dateTime(s.ends_at)}</td>
                  <td>{s.break_minutes} min</td>
                  <td>{hours(s.worked_minutes)}</td>
                  <td>
                    <button
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm('Remove this shift and its working hours?'))
                          void action(
                            () => api(`/employee-shifts/${s.id}`, { method: 'DELETE' }),
                            () => {},
                            'Shift removed.',
                          );
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && !data.shifts.length && (
          <p className="empty">No shifts recorded for this month.</p>
        )}
      </section>
    </section>
  );
}
