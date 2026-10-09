import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number | string; strokeWidth?: number };
// Kipi's rounded, two-tone icon family. Foregrounds inherit each control's color.
function icon(name: string, paths: string[], accent?: string) {
  return function KipiIcon({ size = 24, strokeWidth = 1.9, className = '', ...props }: IconProps) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`lucide kipi-icon kipi-icon-${name} ${className}`}
        aria-hidden="true"
        focusable="false"
        {...props}
      >
        {accent && <path d={accent} fill="currentColor" fillOpacity=".16" stroke="none" />}
        {paths.map((d, i) => (
          <path d={d} key={i} />
        ))}
      </svg>
    );
  };
}
export const ShoppingBag = icon(
  'bag',
  ['M5 7h14l1 13H4L5 7Z', 'M8 8V6a4 4 0 0 1 8 0v2', 'M9 13l3 3 3-3'],
  'M5 7h14l1 13H4Z',
);
export const Package = icon(
  'stock',
  ['M12 2 21 7v10l-9 5-9-5V7l9-5Z', 'M3 7l9 5 9-5M12 12v10', 'M8 4l9 5v4'],
  'M3 7l9 5v10l-9-5Z',
);
export const Users = icon(
  'team',
  [
    'M8 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z',
    'M2 20v-3a6 6 0 0 1 12 0v3H2Z',
    'M17 4a3 3 0 0 1 0 6M17 13a5 5 0 0 1 5 5v2h-5',
  ],
  'M2 20v-3a6 6 0 0 1 12 0v3Z',
);
export const UserRound = icon(
  'customer',
  ['M12 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z', 'M4 21v-2a8 8 0 0 1 16 0v2H4Z'],
  'M4 21v-2a8 8 0 0 1 16 0v2Z',
);
export const BarChart3 = icon(
  'report',
  ['M3 3v18h18', 'M7 17v-5h3v5M13 17V8h3v9M19 17V4h2v13'],
  'M13 8h3v9h-3Z',
);
export const LayoutGrid = icon(
  'register',
  ['M3 3h7v7H3V3ZM14 3h7v7h-7V3ZM3 14h7v7H3v-7ZM14 14h7v7h-7v-7Z'],
  'M3 3h7v7H3ZM14 14h7v7h-7Z',
);
export const Search = icon(
  'search',
  ['M10 3a7 7 0 1 1 0 14 7 7 0 0 1 0-14Z', 'M15 15l6 6'],
  'M10 3a7 7 0 1 1 0 14 7 7 0 0 1 0-14Z',
);
export const Plus = icon('add', ['M12 5v14M5 12h14']);
export const Minus = icon('subtract', ['M5 12h14']);
export const Menu = icon('menu', ['M4 6h16M4 12h16M4 18h16']);
export const X = icon('close', ['M6 6l12 12M18 6 6 18']);
export const Trash2 = icon(
  'delete',
  ['M4 6h16M9 6V3h6v3', 'M6 6l1 15h10l1-15M10 10v7M14 10v7'],
  'M6 6h12l-1 15H7Z',
);
export const ArrowRight = icon('next', ['M3 12h17M14 6l6 6-6 6']);
export const ArrowUpRight = icon('open', ['M5 19 19 5M8 5h11v11']);
export const LogOut = icon('logout', ['M10 3H4v18h6M9 12h12M16 7l5 5-5 5'], 'M4 3h6v18H4Z');
export const Clock = icon(
  'time',
  ['M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Z', 'M12 6v6l4 3'],
  'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Z',
);
export const Banknote = icon(
  'cash',
  ['M2 5h20v14H2V5Z', 'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM5 9v6M19 9v6'],
  'M2 5h20v14H2Z',
);
export const CreditCard = icon('card', ['M3 4h18v16H3V4ZM3 9h18M6 15h5M16 15h2'], 'M3 4h18v5H3Z');
export const Receipt = icon(
  'receipt',
  ['M5 2l3 2 4-2 4 2 3-2v20l-3-2-4 2-4-2-3 2V2Z', 'M8 8h8M8 12h8M8 16h4'],
  'M5 2l3 2 4-2 4 2 3-2v20l-3-2-4 2-4-2-3 2Z',
);
export const Printer = icon(
  'print',
  ['M7 8V2h10v6M6 17H3V8h18v9h-3', 'M6 14h12v8H6v-8ZM17 11h1'],
  'M3 8h18v9h-3v-3H6v3H3Z',
);
export const Coffee = icon(
  'coffee',
  ['M3 8h13v7a6.5 6.5 0 0 1-13 0V8ZM16 9h2a3 3 0 0 1 0 6h-2M2 22h17', 'M6 2v3M11 2v3'],
  'M3 8h13v7a6.5 6.5 0 0 1-13 0Z',
);
export const Bell = icon(
  'notification',
  ['M5 17h14l-2-4V8a5 5 0 0 0-10 0v5l-2 4Z', 'M9 21h6M12 1v2'],
  'M5 17h14l-2-4V8a5 5 0 0 0-10 0v5Z',
);
export const Check = icon('check', ['M4 12l5 5L20 6']);
export const CheckCircle2 = icon(
  'done',
  ['M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Z', 'M7 12l3 3 7-7'],
  'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Z',
);
export const AlertTriangle = icon(
  'alert',
  ['M12 2 23 21H1L12 2ZM12 8v6M12 17h.01'],
  'M12 2 23 21H1Z',
);
export const TrendingUp = icon('growth', ['M2 17l7-7 4 4 9-10M15 4h7v7']);
export const Activity = icon('activity', ['M2 12h4l3-8 6 16 3-8h4']);
export const Moon = icon(
  'dark',
  ['M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z'],
  'M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z',
);
export const Sun = icon(
  'light',
  [
    'M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z',
    'M12 1v2M12 21v2M1 12h2M21 12h2M4 4l2 2M18 18l2 2M4 20l2-2M18 6l2-2',
  ],
  'M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z',
);
export const Tag = icon(
  'promotion',
  ['M2 3h10l10 10-9 9L2 11V3ZM7 7h.01'],
  'M2 3h10l10 10-9 9L2 11Z',
);
export const HelpCircle = icon(
  'help',
  [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z',
    'M9.5 9a2.7 2.7 0 1 1 4.2 2.2c-1.2.8-1.7 1.4-1.7 2.8M12 18h.01',
  ],
  'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z',
);
export const ShieldCheck = icon(
  'privacy',
  ['M12 2 20 5v6c0 5.2-3.4 9-8 11-4.6-2-8-5.8-8-11V5l8-3Z', 'M8.5 12l2.2 2.2 4.8-5'],
  'M12 2 20 5v6c0 5.2-3.4 9-8 11-4.6-2-8-5.8-8-11V5Z',
);
export const NotebookIcon = icon('notebook', [
  'M5 3h15v18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM8 3v18M3 7h3M3 12h3M3 17h3',
  'M8 3h12v18H8Z',
]);
const HEART_PATH =
  'M12 20.5S4 15.4 2.2 11.4C1.1 8.6 3 5.8 6.2 5.8c2 0 3.4 1 4.3 2.3l1.5 2 1.5-2c.9-1.3 2.3-2.3 4.3-2.3 3.2 0 5.1 2.8 4 5.6C20 15.4 12 20.5 12 20.5Z';
export function Heart({
  size = 24,
  strokeWidth = 1.9,
  className = '',
  filled = false,
  ...props
}: IconProps & { filled?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`lucide kipi-icon kipi-icon-heart ${className}`}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d={HEART_PATH} />
    </svg>
  );
}
