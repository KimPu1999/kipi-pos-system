import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api } from './api';
import BrandLogo from './BrandLogo';

type Store = { id: number; code: string; name: string; status: string };
type Admin = {
  membership_id: number;
  membership_status: 'active' | 'inactive';
  user_id: number;
  user_name: string;
  user_email: string;
  store_id: number;
  store_code: string;
  store_name: string;
  store_status: string;
};

export default function PlatformAdmin({ logout }: { logout: ReactNode }) {
  const [stores, setStores] = useState<Store[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    const [storeRows, adminRows] = await Promise.all([
      api<Store[]>('/platform/stores'),
      api<Admin[]>('/platform/admins'),
    ]);
    setStores(storeRows);
    setAdmins(adminRows);
  }
  useEffect(() => {
    void load().catch((e) =>
      setError(e instanceof Error ? e.message : 'Unable to load platform data.'),
    );
  }, []);

  async function createAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const createStore = values.store_mode === 'new';
    const body = {
      name: values.name,
      email: values.email,
      password: values.password,
      password_confirmation: values.password_confirmation,
      ...(createStore
        ? { store: { code: values.store_code, name: values.store_name } }
        : { store_id: Number(values.store_id) }),
    };
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api('/platform/admins', { method: 'POST', body: JSON.stringify(body) });
      await load();
      form.reset();
      setNotice('Store administrator created with one authorized store.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create administrator.');
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(admin: Admin) {
    const status = admin.membership_status === 'active' ? 'inactive' : 'active';
    setBusy(true);
    setError('');
    try {
      await api(`/platform/admins/${admin.membership_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update membership.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="platform-shell">
      <header className="platform-header">
        <BrandLogo />
        <div>
          <span className="eyebrow">PLATFORM CONTROL</span>
          <h1>Stores and administrators</h1>
        </div>
        {logout}
      </header>
      {error && <p className="error">{error}</p>}
      {notice && <p className="success">{notice}</p>}
      <form className="panel platform-admin-form" onSubmit={createAdmin}>
        <h2>Create Store Admin</h2>
        <label>
          Name <input name="name" required maxLength={100} />
        </label>
        <label>
          Email <input name="email" type="email" required maxLength={254} />
        </label>
        <label>
          Password <input name="password" type="password" required minLength={8} maxLength={128} />
        </label>
        <label>
          Confirm password
          <input
            name="password_confirmation"
            type="password"
            required
            minLength={8}
            maxLength={128}
          />
        </label>
        <label>
          Store option
          <select name="store_mode" defaultValue="existing">
            <option value="existing">Assign existing store</option>
            <option value="new">Create new store</option>
          </select>
        </label>
        <label>
          Existing store
          <select name="store_id" defaultValue={stores[0]?.id || ''}>
            {stores
              .filter((store) => store.status === 'active')
              .map((store) => (
                <option value={store.id} key={store.id}>
                  {store.name} ({store.code})
                </option>
              ))}
          </select>
        </label>
        <label>
          New store code <input name="store_code" maxLength={50} />
        </label>
        <label>
          New store name <input name="store_name" maxLength={150} />
        </label>
        <button className="primary" disabled={busy}>
          {busy ? 'Saving…' : 'Create administrator'}
        </button>
      </form>
      <section className="panel">
        <h2>Store administrators</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Administrator</th>
                <th>Store</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin.membership_id}>
                  <td>
                    <b>{admin.user_name}</b>
                    <small>{admin.user_email}</small>
                  </td>
                  <td>{admin.store_name}</td>
                  <td>{admin.membership_status}</td>
                  <td>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => void setStatus(admin)}
                    >
                      {admin.membership_status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
