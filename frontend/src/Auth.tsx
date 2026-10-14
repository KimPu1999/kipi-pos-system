import BrandLogo from './BrandLogo';
import ThemeToggle from './ThemeToggle';
import { useEffect, useState, type FormEvent } from 'react';
import { ShoppingBag, LogOut } from './icons';
import Portal from './Portal';
import { api, ApiError, type User } from './api';
import PlatformAdmin from './PlatformAdmin';
export default function Auth() {
  const [user, setUser] = useState<User | null>(null);
  const [stores, setStores] = useState<Store[] | null>(null);
  const [storeReady, setStoreReady] = useState(false);
  const [platformReady, setPlatformReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string[]>>({});
  async function checkSession() {
    setChecking(true);
    setError('');
    try {
      setUser(await api<User>('/auth/user'));
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401))
        setError('Unable to connect. Check that the Laravel API is running.');
    } finally {
      setChecking(false);
    }
  }
  useEffect(() => {
    void checkSession();
    const expired = () => {
      setUser(null);
    };
    window.addEventListener('auth-expired', expired);
    return () => window.removeEventListener('auth-expired', expired);
  }, []);
  useEffect(() => {
    if (!user) {
      setStores(null);
      setStoreReady(false);
      setPlatformReady(false);
      return;
    }
    let active = true;
    setBusy(true);
    setError('');
    api<{ permissions: string[] }>('/platform/me')
      .then(async ({ permissions }) => {
        if (!active) return;
        if (
          permissions.includes('platform.stores.manage') &&
          permissions.includes('platform.memberships.manage')
        ) {
          setPlatformReady(true);
          return;
        }
        const available = await api<Store[]>('/stores');
        if (!active) return;
        if (user.role === 'admin') {
          // Store admins never pick a store: the backend resolves their single
          // authorized store from their membership on every request.
          if (available.length !== 1) {
            throw new Error(
              'Your account is not linked to a single active store. Contact a platform administrator.',
            );
          }
          setStoreReady(true);
          return;
        }
        // Customers: backend auto-resolves store from active store_customers links.
        // No manual store selection.
        setStoreReady(true);
        return;
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : 'Unable to load stores.'))
      .finally(() => active && setBusy(false));
    return () => {
      active = false;
    };
  }, [user]);
  async function selectStore(storeId: number) {
    setBusy(true);
    setError('');
    try {
      await api('/stores/select', {
        method: 'POST',
        body: JSON.stringify({ store_id: storeId }),
      });
      setStoreReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to select this store.');
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setFields({});
    const data = new FormData(event.currentTarget);
    const body = Object.fromEntries(data.entries());
    body.email = String(body.email).trim().toLowerCase();
    try {
      setUser(await api<User>('/auth/login', { method: 'POST', body: JSON.stringify(body) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
      if (e instanceof ApiError) setFields(e.fields);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    setError('');
    try {
      await api('/auth/logout', { method: 'POST' });
      setUser(null);
      setStores(null);
      setStoreReady(false);
      setPlatformReady(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to sign out. Please retry.');
    } finally {
      setBusy(false);
    }
  }
  const logoutButton = (
    <button className="logout" onClick={logout} disabled={busy}>
      <LogOut size={17} /> {busy ? 'Signing out…' : 'Log out'}
    </button>
  );
  if (checking)
    return (
      <div className="auth-shell">
        <p role="status">Checking your session…</p>
      </div>
    );
  if (user && platformReady) return <PlatformAdmin logout={logoutButton} />;
  if (user && user.role === 'admin' && !storeReady)
    return (
      <div className="auth-shell">
        <section className="auth-card">
          <div className="auth-brand">
            <BrandLogo />
          </div>
          <span className="eyebrow">KIPI POS</span>
          <h1>{error ? 'Store access unavailable' : 'Preparing your store…'}</h1>
          <p>
            {error
              ? 'This administrator account could not be matched to a single active store, so access is denied.'
              : 'Resolving your assigned store from your account membership.'}
          </p>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {logoutButton}
        </section>
      </div>
    );
  if (user && user.role !== 'admin' && !storeReady)
    return (
      <div className="auth-shell">
        <section className="auth-card">
          <div className="auth-brand">
            <BrandLogo />
          </div>
          <span className="eyebrow">KIPI POS</span>
          <h1>{error ? 'Store access unavailable' : 'Opening your store…'}</h1>
          <p>
            {error
              ? 'This customer account could not be matched to a single active store, so access is denied.'
              : 'Preparing your account.'}
          </p>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {logoutButton}
        </section>
      </div>
    );
  if (user)
    return (
      <>
        <Portal user={user} logout={logoutButton} />
        {error && (
          <div className="auth-toast" role="alert">
            {error}
          </div>
        )}
      </>
    );
  return (
    <div className="auth-shell">
      <div className="auth-theme-toggle">
        <ThemeToggle />
      </div>
      <section className="auth-card">
        <div className="auth-brand">
          <BrandLogo />
        </div>
        <span className="eyebrow">YOUR EVERYDAY BUSINESS</span>
        <h1>Welcome back</h1>
        <p>Sign in to your store workspace or customer account.</p>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <form onSubmit={submit}>
          <label>
            Email address
            <input name="email" type="email" autoComplete="email" required maxLength={254} />
            {fields.email && <small>{fields.email[0]}</small>}
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
            />
            {fields.password && <small>{fields.password[0]}</small>}
          </label>
          <button className="primary" disabled={busy}>
            {busy ? 'Please wait…' : 'Log in'}
          </button>
        </form>
        <p className="muted">
          Need an account? Please contact your store administrator to create one.
        </p>
        <button className="auth-retry" onClick={() => void checkSession()} disabled={busy}>
          Check connection
        </button>
      </section>
    </div>
  );
}

type Store = {
  id: number;
  code: string;
  name: string;
  timezone: string;
  currency: string;
};
