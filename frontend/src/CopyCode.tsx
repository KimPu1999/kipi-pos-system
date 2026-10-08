import { useState } from 'react';
export default function CopyCode({
  code,
  onUse,
}: {
  code: string;
  onUse?: (code: string) => void;
}) {
  const [used, setUsed] = useState(false),
    [error, setError] = useState('');
  async function use() {
    setError('');
    if (onUse) {
      onUse(code);
      setUsed(true);
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      setUsed(true);
    } catch {
      setError('Select this code to copy it manually.');
    }
  }
  return (
    <>
      <button
        type="button"
        className={`promotion-code-button${used ? ' used' : ''}`}
        onClick={() => void use()}
        aria-pressed={used}
        aria-label={onUse ? `Use promotion code ${code}` : `Copy promotion code ${code}`}
      >
        {code}
      </button>
      {error && <small role="alert">{error}</small>}
    </>
  );
}
