import { useEffect, useState } from 'react';
import BrandLogo from './BrandLogo';
import { api } from './api';
import type { Settings } from './systemSettings';
export default function CustomerSettings() {
  const [storeName, setStoreName] = useState('Kipi POS');
  useEffect(() => {
    let current = true;
    void api<Settings>('/settings')
      .then((s) => {
        if (current) setStoreName(s.store_name);
      })
      .catch(() => {});
    const changed = (e: Event) => setStoreName((e as CustomEvent<Settings>).detail.store_name);
    const sync = () => {
      try {
        setTheme(
          localStorage.getItem('counter-theme-customer') ||
            document.documentElement.dataset.theme ||
            'light',
        );
      } catch {}
    };
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    window.addEventListener('store-settings', changed);
    return () => {
      current = false;
      observer.disconnect();
      window.removeEventListener('store-settings', changed);
    };
  }, []);
  const [theme, setTheme] = useState(() => {
      try {
        return (
          localStorage.getItem('counter-theme-customer') ||
          document.documentElement.dataset.theme ||
          'light'
        );
      } catch {
        return 'light';
      }
    }),
    [size, setSize] = useState(() => {
      try {
        return localStorage.getItem('counter-text-size') || 'default';
      } catch {
        return 'default';
      }
    }),
    [notice, setNotice] = useState(''),
    [color, setColor] = useState(() => {
      try {
        return localStorage.getItem('counter-customer-accent') || 'default';
      } catch {
        return 'default';
      }
    });
  function chooseColor(value: string) {
    setColor(value);
    try {
      if (value === 'default') localStorage.removeItem('counter-customer-accent');
      else localStorage.setItem('counter-customer-accent', value);
    } catch {}
    document.documentElement.style.setProperty(
      '--setting-accent',
      value === 'default' ? document.documentElement.dataset.defaultAccent || '#d96700' : value,
    );
    document.documentElement.dataset.customSettings = 'true';
    setNotice('Your customer color preference is saved for this browser.');
  }
  function setAppearance(nextTheme: string, nextSize: string) {
    setTheme(nextTheme);
    setSize(nextSize);
    const root = document.documentElement;
    try {
      if (nextTheme === 'default') localStorage.removeItem('counter-theme-customer');
      else localStorage.setItem('counter-theme-customer', nextTheme);
      if (nextSize === 'default') localStorage.removeItem('counter-text-size');
      else localStorage.setItem('counter-text-size', nextSize);
    } catch {}
    root.dataset.theme = nextTheme === 'default' ? root.dataset.defaultTheme || 'light' : nextTheme;
    root.style.setProperty(
      '--setting-font-size',
      nextSize === 'default' ? root.dataset.defaultFontSize || '16px' : `${nextSize}px`,
    );
    root.dataset.customSettings = 'true';
    setNotice('Your appearance preference is saved for this browser.');
  }
  return (
    <div className="customer-settings-workspace">
      <section className="panel customer-settings-store">
        <BrandLogo showPos={false} />
        <div>
          <p className="muted">Customer store · Prices in MMK</p>
          <p>Your display preferences apply to this customer site in this browser.</p>
        </div>
      </section>
      <section className="panel">
        <h2>Appearance</h2>
        <p className="muted">Choose how the store looks in this browser.</p>
        {notice && (
          <p className="success" role="status">
            {notice}
          </p>
        )}
        <div className="settings-fields">
          <label>
            Theme
            <select value={theme} onChange={(e) => setAppearance(e.target.value, size)}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label>
            Text size
            <select value={size} onChange={(e) => setAppearance(theme, e.target.value)}>
              <option value="default">Customer default</option>
              {[14, 16, 18, 20].map((n) => (
                <option key={n} value={n}>
                  {n}px
                </option>
              ))}
            </select>
          </label>
          <label>
            Accent color
            <select value={color} onChange={(e) => chooseColor(e.target.value)}>
              <option value="default">Customer default</option>
              <option value="#d96700">Orange</option>
              <option value="#1d4ed8">Blue</option>
              <option value="#166534">Green</option>
              <option value="#7e22ce">Purple</option>
            </select>
          </label>
        </div>
        <button
          className="secondary"
          onClick={() => {
            setAppearance('light', 'default');
            chooseColor('default');
          }}
        >
          Reset to customer defaults
        </button>
        <div className="customer-appearance-preview">
          <strong>Your appearance preview</strong>
          <p>Browse products, review your bag, and track your orders.</p>
          <button type="button" className="primary" disabled>
            Selected appearance
          </button>
        </div>
      </section>
    </div>
  );
}
