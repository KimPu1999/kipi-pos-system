import { useEffect, useState } from 'react';
import { Moon, Sun } from './icons';
export default function ThemeToggle({ role = 'guest' }: { role?: 'admin' | 'customer' | 'guest' }) {
  const storageKey = `counter-theme-${role}`;
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark');
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setDark(root.dataset.theme === 'dark');
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    const stored = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      root.dataset.theme =
        event.newValue === 'dark' || event.newValue === 'light'
          ? event.newValue
          : root.dataset.defaultTheme || 'light';
    };
    window.addEventListener('storage', stored);
    sync();
    return () => {
      observer.disconnect();
      window.removeEventListener('storage', stored);
    };
  }, [storageKey]);
  function toggle() {
    const next = document.documentElement.dataset.theme !== 'dark';
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    setDark(next);
    try {
      localStorage.setItem(storageKey, next ? 'dark' : 'light');
    } catch {}
  }
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={dark}
      onClick={toggle}
    >
      {dark ? <Sun size={19} /> : <Moon size={19} />}
      <span>{dark ? 'Light' : 'Dark'}</span>
    </button>
  );
}
