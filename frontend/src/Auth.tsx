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
  const [mode, setMode] = useState<'login' | 'register'>('login');
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
        setStores(available);
        if (available.length === 1) {
          await api('/stores/select', {
            method: 'POST',
            body: JSON.stringify({ store_id: available[0].id }),
          });
          if (active) setStoreReady(true);
        }
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
      setUser(await api<User>(`/auth/${mode}`, { method: 'POST', body: JSON.stringify(body) }));
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
      setMode('login');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to sign out. Please retry.');
    } finally {
      setBusy(false);
    }
  }
  if (checking)
    return (
      <div className="auth-shell">
        <p role="status">Checking your session…</p>
      </div>
    );
  if (user && platformReady)
    return (
      <PlatformAdmin
        logout={
          <button className="logout" onClick={logout} disabled={busy}>
            <LogOut size={17} /> {busy ? 'Signing out…' : 'Log out'}
          </button>
        }
      />
    );
  if (user && (!storeReady || !stores))
    return (
      <div className="auth-shell">
        <section className="auth-card store-picker">
          <div className="auth-brand">
            <BrandLogo />
          </div>
          <span className="eyebrow">KIPI POS</span>
          <h1>{stores?.length === 1 ? 'Opening your store…' : 'Choose a store'}</h1>
          <p>Select the store you want to browse or manage.</p>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {stores?.length === 0 && <p className="error">No active store is available.</p>}
          <div className="store-picker-list">
            {stores?.map((store) => (
              <button
                className="store-picker-option"
                key={store.id}
                onClick={() => void selectStore(store.id)}
                disabled={busy}
              >
                <strong>{store.name}</strong>
                <span>
                  {store.code} · {store.currency}
                </span>
              </button>
            ))}
          </div>
          <button className="logout" onClick={logout} disabled={busy}>
            <LogOut size={17} /> Log out
          </button>
        </section>
      </div>
    );
  if (user)
    return (
      <>
        <Portal
          user={user}
          logout={
            <button className="logout" onClick={logout} disabled={busy}>
              <LogOut size={17} />
              {busy ? 'Signing out…' : 'Log out'}
            </button>
          }
        />
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
        <h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
        <p>
          {mode === 'login'
            ? 'Sign in to your store workspace.'
            : 'Create an account to browse and place pickup orders.'}
        </p>
        <div className="auth-tabs">
          <button
            className={mode === 'login' ? 'selected' : ''}
            onClick={() => {
              setMode('login');
              setError('');
              setFields({});
            }}
          >
            Log in
          </button>
          <button
            className={mode === 'register' ? 'selected' : ''}
            onClick={() => {
              setMode('register');
              setError('');
              setFields({});
            }}
          >
            Register
          </button>
        </div>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <form key={mode} onSubmit={submit}>
          {mode === 'register' && (
            <label>
              Full name
              <input name="name" autoComplete="name" required maxLength={100} />
              {fields.name && <small>{fields.name[0]}</small>}
            </label>
          )}
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
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={mode === 'register' ? 8 : undefined}
              maxLength={128}
            />
            {fields.password && <small>{fields.password[0]}</small>}
          </label>
          {mode === 'register' && (
            <label>
              Confirm password
              <input
                name="password_confirmation"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
              />
              <span className="muted">Use at least 8 characters.</span>
            </label>
          )}
          <button className="primary" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>
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
