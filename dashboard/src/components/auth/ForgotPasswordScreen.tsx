/**
 * ForgotPasswordScreen.tsx
 * Always shows a generic confirmation (no user enumeration).
 * In development the backend returns a devResetUrl which we surface for testing.
 */

import { useState, type FormEvent } from 'react';
import { forgotPassword } from '../../api';
import {
  screenWrap, card, brandRow, title, subtitle, label, input,
  fieldGroup, primaryButton, linkButton, successBox, devBox, colors,
} from './authStyles';

interface Props {
  onBackToLogin: () => void;
}

const GENERIC = 'If an account exists for that email, password reset instructions have been sent.';

export function ForgotPasswordScreen({ onBackToLogin }: Props) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await forgotPassword(email.trim());
      setDevResetUrl(res.devResetUrl ?? null);
    } catch {
      // Never reveal failures here; show the generic response regardless.
      setDevResetUrl(null);
    } finally {
      setSubmitted(true);
      setBusy(false);
    }
  }

  return (
    <div style={screenWrap}>
      <form style={card} onSubmit={handleSubmit} noValidate>
        <div style={brandRow}>
          <span aria-hidden style={{ fontSize: 22 }}>🔑</span>
          <h1 style={title}>Reset your password</h1>
        </div>
        <p style={subtitle}>
          Enter your account email and we’ll send instructions to reset your password.
        </p>

        {submitted ? (
          <>
            <div style={successBox} role="status">{GENERIC}</div>
            {devResetUrl && (
              <div style={devBox}>
                <strong>DEV ONLY</strong> — reset link (not shown in production):
                <br />
                <a href={devResetUrl} style={{ color: colors.warning }}>{devResetUrl}</a>
              </div>
            )}
            <button
              type="button"
              style={{ ...linkButton, display: 'block', margin: '20px auto 0' }}
              onClick={onBackToLogin}
            >
              ← Back to sign in
            </button>
          </>
        ) : (
          <>
            <div style={fieldGroup}>
              <label htmlFor="forgot-email" style={label}>Email</label>
              <input
                id="forgot-email"
                type="email"
                autoComplete="username"
                style={input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <button
              type="submit"
              style={{ ...primaryButton, opacity: busy ? 0.7 : 1 }}
              disabled={busy}
            >
              {busy ? 'Sending…' : 'Send reset instructions'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button type="button" style={linkButton} onClick={onBackToLogin}>
                ← Back to sign in
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
