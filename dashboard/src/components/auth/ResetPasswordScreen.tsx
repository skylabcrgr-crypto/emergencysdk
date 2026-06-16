/**
 * ResetPasswordScreen.tsx
 * Reads the reset token from the URL (?token=...), validates a new password
 * against the shared policy, and submits. Shown when the URL path is
 * /reset-password.
 */

import { useState, type FormEvent } from 'react';
import { resetPassword, ApiError } from '../../api';
import { evaluatePassword } from '../../auth/passwordPolicy';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import {
  screenWrap, card, brandRow, title, subtitle, label, input,
  fieldGroup, primaryButton, linkButton, errorBox, successBox, colors,
} from './authStyles';

interface Props {
  token: string | null;
  onDone: () => void;
}

export function ResetPasswordScreen({ token, onDone }: Props) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const { valid } = evaluatePassword(password);
  const matches = password.length > 0 && password === confirm;
  const canSubmit = !!token && valid && matches && !busy;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setBusy(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 400 || err.code === 'INVALID_TOKEN' || err.status === 404)) {
        setError('This reset link is invalid or has expired. Please request a new one.');
      } else {
        setError('Unable to reset your password. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={screenWrap}>
      <form style={card} onSubmit={handleSubmit} noValidate>
        <div style={brandRow}>
          <span aria-hidden style={{ fontSize: 22 }}>🔐</span>
          <h1 style={title}>Set a new password</h1>
        </div>

        {!token ? (
          <>
            <p style={subtitle}>This reset link is missing or malformed.</p>
            <div style={errorBox} role="alert">
              No reset token was provided. Please use the link from your email or request a new one.
            </div>
            <button type="button" style={{ ...linkButton, display: 'block', margin: '0 auto' }} onClick={onDone}>
              ← Back to sign in
            </button>
          </>
        ) : done ? (
          <>
            <div style={successBox} role="status">
              Your password has been updated. You can now sign in with your new password.
            </div>
            <button
              type="button"
              style={{ ...primaryButton, marginTop: 4 }}
              onClick={onDone}
            >
              Go to sign in
            </button>
          </>
        ) : (
          <>
            <p style={subtitle}>Choose a strong password that meets all requirements below.</p>

            {error && <div style={errorBox} role="alert">{error}</div>}

            <div style={fieldGroup}>
              <label htmlFor="reset-password" style={label}>New password</label>
              <input
                id="reset-password"
                type="password"
                autoComplete="new-password"
                style={input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
              />
            </div>

            <PasswordStrengthMeter password={password} />

            <div style={fieldGroup}>
              <label htmlFor="reset-confirm" style={label}>Confirm new password</label>
              <input
                id="reset-confirm"
                type="password"
                autoComplete="new-password"
                style={input}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
              {confirm.length > 0 && !matches && (
                <div style={{ color: colors.danger, fontSize: 12, marginTop: 6 }}>
                  Passwords do not match.
                </div>
              )}
            </div>

            <button
              type="submit"
              style={{ ...primaryButton, opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? 'pointer' : 'not-allowed' }}
              disabled={!canSubmit}
            >
              {busy ? 'Updating…' : 'Update password'}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
