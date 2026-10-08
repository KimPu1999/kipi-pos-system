import BrandLogo from './BrandLogo';
import ThemeToggle from './ThemeToggle';
import { useEffect, useState, type FormEvent } from 'react';
import { ShoppingBag, LogOut } from './icons';
import Portal from './Portal';
import { api, ApiError, type User } from './api';
export default function Auth() {
  const [user, setUser] = useState<User | null>(null);
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
