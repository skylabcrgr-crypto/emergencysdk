/**
 * TempPasswordReveal.tsx
 * Shows a one-time temporary password with a copy-to-clipboard button and a
 * warning that it won't be shown again.
 */

import { useState } from 'react';
import { colors, devBox } from '../auth/authStyles';

interface Props {
  password: string;
  warning: string;
}

export function TempPasswordReveal({ password, warning }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div style={{ ...devBox, borderStyle: 'solid', marginTop: 0, marginBottom: 16 }}>
      <div style={{ color: colors.warning, fontWeight: 700, marginBottom: 6 }}>
        Temporary password
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <code
          style={{
            flex: 1,
            backgroundColor: '#000',
            color: colors.text,
            padding: '8px 10px',
            borderRadius: 6,
            fontSize: 14,
            letterSpacing: 0.5,
            userSelect: 'all',
          }}
        >
          {password}
        </code>
        <button
          type="button"
          onClick={copy}
          style={{
            backgroundColor: colors.accent,
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '8px 12px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div style={{ color: '#f3cd7e', fontSize: 12, marginTop: 8 }}>⚠ {warning}</div>
    </div>
  );
}
