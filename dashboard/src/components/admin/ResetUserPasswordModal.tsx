/**
 * ResetUserPasswordModal.tsx
 * Admin resets a user's password to a generated temporary one (shown once).
 */

import { useState } from 'react';
import { resetUserPassword, type ManagedUser } from '../../api';
import { primaryButton, secondaryButton, errorBox, colors } from '../auth/authStyles';
import { Modal } from './Modal';
import { TempPasswordReveal } from './TempPasswordReveal';

interface Props {
  user: ManagedUser;
  onClose: () => void;
}

export function ResetUserPasswordModal({ user, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ password: string; warning: string } | null>(null);

  async function doReset() {
    setError(null);
    setBusy(true);
    try {
      const res = await resetUserPassword(user.id);
      setResult({ password: res.temporaryPassword, warning: res.warning });
    } catch {
      setError('Could not reset password. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Reset password" onClose={onClose}>
      {error && <div style={errorBox} role="alert">{error}</div>}

      {result ? (
        <>
          <p style={{ color: colors.textDim, fontSize: 13, marginTop: 0, marginBottom: 14 }}>
            A new temporary password has been set for{' '}
            <strong style={{ color: colors.text }}>{user.email}</strong>.
          </p>
          <TempPasswordReveal password={result.password} warning={result.warning} />
          <button type="button" style={primaryButton} onClick={onClose}>Done</button>
        </>
      ) : (
        <>
          <p style={{ color: colors.textDim, fontSize: 13, marginTop: 0, marginBottom: 18, lineHeight: 1.5 }}>
            Generate a new temporary password for{' '}
            <strong style={{ color: colors.text }}>{user.email}</strong>? Their current password will
            stop working immediately.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" style={{ ...primaryButton, opacity: busy ? 0.7 : 1 }} disabled={busy} onClick={doReset}>
              {busy ? 'Resetting…' : 'Reset password'}
            </button>
            <button type="button" style={secondaryButton} onClick={onClose}>Cancel</button>
          </div>
        </>
      )}
    </Modal>
  );
}
