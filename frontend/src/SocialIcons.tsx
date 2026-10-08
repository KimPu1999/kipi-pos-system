import type { SVGProps } from 'react';
type Props = SVGProps<SVGSVGElement> & { size?: number };
export function FacebookIcon({ size = 20, ...props }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M14 8h3V4h-3c-3.3 0-5 2-5 5v2H6v4h3v7h4v-7h3.2l.8-4h-4V9c0-.7.3-1 1-1Z" />
    </svg>
  );
}
export function InstagramIcon({ size = 20, ...props }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      {...props}
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
export function TikTokIcon({ size = 20, ...props }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M14 3h3c.3 2.2 1.5 3.5 4 4v3c-1.6 0-3-.5-4-1.3V16a6 6 0 1 1-6-6v3a3 3 0 1 0 3 3V3Z" />
    </svg>
  );
}
