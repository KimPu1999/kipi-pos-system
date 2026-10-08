import { useEffect, useState, type FormEvent } from 'react';
import { api } from './api';
import { applySettings, type Settings as SettingsData } from './systemSettings';
type Info = {
  app_version: string;
  laravel_version: string;
  php_version: string;
  currency: string;
  timezone: string;
  database: string;
};
export default function Settings() {
  const [preview, setPreview] = useState(false);
  const defaults: SettingsData = {
    store_name: 'Kipi POS',
    accent: '#d96700',
    light_background: '#f5f2ee',
    light_text: '#29231e',
    dark_background: '#131519',
    dark_text: '#f2f4f8',
    font_size: 16,
    font_weight: 600,
    default_theme: 'light',
    tax_percent: 0,
  };
  const [data, setData] = useState<SettingsData | null>(null),
    [savedData, setSavedData] = useState<SettingsData | null>(null),
    [info, setInfo] = useState<Info | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  async function refreshSettings(showNotice = true) {
    setBusy(true);
    setError('');
    try {
      const [settings, systemInfo] = await Promise.all([
        api<SettingsData>('/settings'),
        api<Info>('/settings/system'),
      ]);
      setData(settings);
      setSavedData(settings);
      setInfo(systemInfo);
      setRefreshedAt(new Date());
      applySettings(settings);
      if (showNotice) setNotice('Saved settings and system information refreshed.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to refresh settings.');
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void refreshSettings(false);
  }, []);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!data) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await api<SettingsData>('/settings', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      setData(result);
      setSavedData(result);
      applySettings(result);
      setRefreshedAt(new Date());
      setNotice('Settings saved. Other users receive changes on their next refresh.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save settings.');
    } finally {
      setBusy(false);
    }
  }
  const hasChanges = !!data && !!savedData && JSON.stringify(data) !== JSON.stringify(savedData);
  function exportSettings() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob),
      link = document.createElement('a');
    link.href = url;
    link.download = 'counter-settings.json';
    link.click();
    URL.revokeObjectURL(url);
  }
  async function importSettings(file: File) {
    try {
      if (file.size > 10000) throw new Error('Settings file is too large.');
      const parsed = JSON.parse(await file.text());
      const keys = Object.keys(defaults) as (keyof SettingsData)[];
      if (!parsed || Array.isArray(parsed) || keys.some((key) => !(key in parsed)))
        throw new Error('Choose a complete settings export.');
      setData(Object.fromEntries(keys.map((key) => [key, parsed[key]])) as SettingsData);
      setNotice('Settings imported into the form. Review and save to apply.');
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid settings file.');
    }
  }
  return (
    <section className="purchase-workspace">
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
      {!data && !error && <p role="status">Loading settings…</p>}
      {data && (
        <section className="panel settings-update-panel">
          <div>
            <span className="eyebrow">SETTINGS CONTROL</span>
            <h2>Update & refresh</h2>
            <p className="muted">
              Save current changes or reload the latest settings stored by Laravel.
            </p>
          </div>
          <div className="settings-update-status" aria-live="polite">
            <span className={hasChanges ? 'has-changes' : 'is-current'}>
              {hasChanges ? 'Unsaved changes' : 'Settings are up to date'}
            </span>
            {refreshedAt && <small>Last refreshed {refreshedAt.toLocaleTimeString()}</small>}
          </div>
          <div className="settings-update-actions">
            <button
              type="submit"
              form="system-settings-form"
              className="primary"
              disabled={busy || !hasChanges}
            >
              {busy ? 'Updating…' : 'Update settings'}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => {
                if (
                  !hasChanges ||
                  window.confirm('Discard unsaved changes and reload saved settings?')
                )
                  void refreshSettings();
              }}
            >
              Refresh settings
            </button>
          </div>
        </section>
      )}
      {data && (
        <form id="system-settings-form" className="panel" onSubmit={save}>
          <h2>Store & appearance</h2>
          <p className="muted">
            Changes take effect when you save. Presets change appearance fields and preserve your
            store name.
          </p>
          <div className="settings-toolbar">
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() =>
                setData({
                  ...data,
                  accent: '#d96700',
                  light_background: '#f5f2ee',
                  light_text: '#29231e',
                  dark_background: '#131519',
                  dark_text: '#f2f4f8',
                })
              }
            >
              Orange preset
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() =>
                setData({
                  ...data,
                  accent: '#1d4ed8',
                  light_background: '#f1f5f9',
                  light_text: '#172033',
                  dark_background: '#111827',
                  dark_text: '#f3f4f6',
                })
              }
            >
              Blue preset
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() =>
                setData({
                  ...data,
                  accent: '#166534',
                  light_background: '#f4f7f2',
                  light_text: '#203125',
                  dark_background: '#142019',
                  dark_text: '#f0fdf4',
                })
              }
            >
              Green preset
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Reset the settings form to defaults? Save to apply.')) {
                  setData(defaults);
                  setNotice('Defaults loaded into the form. Save to apply.');
                }
              }}
            >
              Reset defaults
            </button>
          </div>
          <fieldset disabled={busy} className="settings-fields">
            <label>
              Store name
              <input
                required
                maxLength={80}
                value={data.store_name}
                onChange={(e) => setData({ ...data, store_name: e.target.value })}
              />
            </label>
            {(
              [
                ['accent', 'Accent color'],
                ['light_background', 'Light background'],
                ['light_text', 'Light text'],
                ['dark_background', 'Dark background'],
                ['dark_text', 'Dark text'],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  type="color"
                  value={data[key]}
                  onChange={(e) => setData({ ...data, [key]: e.target.value })}
                />
                <small>{data[key]}</small>
              </label>
            ))}
            <label className="tax-setting-field">
              Tax percentage
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={data.tax_percent}
                onChange={(e) => setData({ ...data, tax_percent: Number(e.target.value) })}
              />
              <small>Applied after discounts. Enter 0 to disable tax.</small>
            </label>
            <label>
              Text size
              <select
                value={data.font_size}
                onChange={(e) => setData({ ...data, font_size: Number(e.target.value) })}
              >
                {[14, 15, 16, 17, 18, 19, 20].map((size) => (
                  <option key={size} value={size}>
                    {size}px
                  </option>
                ))}
              </select>
            </label>
            <label>
              Text weight
              <select
                value={data.font_weight}
                onChange={(e) => setData({ ...data, font_weight: Number(e.target.value) })}
              >
                {[
                  [400, 'Regular'],
                  [500, 'Medium'],
                  [600, 'Semi bold'],
                  [700, 'Bold'],
                ].map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary">{busy ? 'Saving…' : 'Save settings'}</button>
          </fieldset>
          <div className="settings-toolbar">
            <button type="button" className="secondary" disabled={busy} onClick={exportSettings}>
              Export settings
            </button>
            <label className="settings-import">
              Import settings
              <input
                type="file"
                accept="application/json,.json"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void importSettings(file);
                }}
              />
            </label>
            <button type="button" className="secondary" onClick={() => setPreview((v) => !v)}>
              {preview ? 'Hide preview' : 'Show color preview'}
            </button>
          </div>
          {preview && (
            <div className="settings-preview-grid">
              {(['light', 'dark'] as const).map((theme) => (
                <div
                  key={theme}
                  style={{
                    background: data[`${theme}_background`],
                    color: data[`${theme}_text`],
                    fontSize: data.font_size,
                    fontWeight: data.font_weight,
                  }}
                >
                  <h3>{theme === 'light' ? 'Light' : 'Dark'} preview</h3>
                  <p>Your selected colors and text size.</p>
                  <span
                    style={{
                      background: data.accent,
                      color: '#fff',
                      padding: '10px 16px',
                      borderRadius: 8,
                      display: 'inline-block',
                    }}
                  >
                    Accent button
                  </span>
                </div>
              ))}
            </div>
          )}
        </form>
      )}
      {info && (
        <section className="panel">
          <h2>Version & system information</h2>
          <div className="product-summary">
            {Object.entries(info).map(([key, value]) => (
              <div key={key}>
                {key.replaceAll('_', ' ')}
                <b>{value}</b>
              </div>
            ))}
          </div>
          <details className="settings-upgrade">
            <summary>Upgrade & maintenance guide</summary>
            <ol>
              <li>Back up your database and private uploaded images before upgrading.</li>
              <li>Install a reviewed application release.</li>
              <li>
                From backend, run <code>composer install --no-dev --optimize-autoloader</code>, then{' '}
                <code>php artisan migrate --force</code> and <code>php artisan config:clear</code>.
              </li>
              <li>
                From frontend, run <code>npm ci</code> and <code>npm run build</code>.
              </li>
              <li>Restart the API and scheduler, then verify login, checkout and reports.</li>
            </ol>
            <p className="muted">
              No release server is configured. This page cannot check for newer versions or install
              an upgrade.
            </p>
          </details>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => {
              setError('');
              void api<Info>('/settings/system')
                .then((i) => {
                  setInfo(i);
                  setNotice('System information refreshed.');
                })
                .catch((e) => setError(e.message));
            }}
          >
            Refresh system information
          </button>
        </section>
      )}
    </section>
  );
}
