import { useState } from 'react';
export default function BrandLogo({ showPos = true }: { showPos?: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="kipi-brand-lockup">
      {failed ? (
        <span className="brand-image-fallback">Kipi</span>
      ) : (
        <img
          className="kipi-brand-image"
          src="/kipi-logo-transparent.png"
          alt="Kipi"
          width={104}
          height={54}
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
      {showPos && <span className="kipi-pos-text">POS</span>}
    </span>
  );
}
