export type Settings = {
  store_name: string;
  accent: string;
  light_background: string;
  light_text: string;
  dark_background: string;
  dark_text: string;
  font_family: 'dm_sans' | 'system' | 'manrope' | 'georgia' | 'monospace';
  font_size: number;
  font_weight: number;
  default_theme: 'light' | 'dark';
  tax_percent: number;
};
export function applySettings(s: Settings) {
  const root = document.documentElement;
  const customer = root.dataset.portalRole === 'customer';
  const appearance = customer
    ? {
        ...s,
        accent: '#d96700',
        light_background: '#f5f2ee',
        light_text: '#29231e',
        dark_background: '#131519',
        dark_text: '#f2f4f8',
        default_theme: 'light' as const,
      }
    : s;
  root.dataset.customSettings = 'true';
  root.dataset.defaultTheme = appearance.default_theme;
  root.dataset.defaultAccent = appearance.accent;
  for (const key of [
    'accent',
    'light_background',
    'light_text',
    'dark_background',
    'dark_text',
  ] as const)
    root.style.setProperty(`--setting-${key.replaceAll('_', '-')}`, appearance[key]);
  root.dataset.defaultFontSize = `${appearance.font_size}px`;
  let personalSize: string | null = null;
  try {
    personalSize = localStorage.getItem('counter-text-size');
  } catch {}
  root.style.setProperty(
    '--setting-font-size',
    customer && personalSize && ['14', '16', '18', '20'].includes(personalSize)
      ? `${personalSize}px`
      : `${appearance.font_size}px`,
  );
  const fontFamilies: Record<Settings['font_family'], string> = {
    dm_sans: "'DM Sans', sans-serif",
    system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    manrope: "'Manrope', 'DM Sans', sans-serif",
    georgia: "Georgia, 'Times New Roman', serif",
    monospace: "'SFMono-Regular', Consolas, 'Liberation Mono', monospace",
  };
  root.style.setProperty('--setting-font-family', fontFamilies[appearance.font_family]);
  root.style.setProperty('--setting-font-weight', String(appearance.font_weight));
  document.title = s.store_name;
  try {
    const themeKey = `counter-theme-${root.dataset.portalRole || 'guest'}`;
    const savedTheme = localStorage.getItem(themeKey);
    root.dataset.theme =
      savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : appearance.default_theme;
    if (customer) {
      const color = localStorage.getItem('counter-customer-accent');
      if (color && /^#[0-9a-fA-F]{6}$/.test(color))
        root.style.setProperty('--setting-accent', color);
    }
  } catch {}
  window.dispatchEvent(new CustomEvent('store-settings', { detail: s }));
}
