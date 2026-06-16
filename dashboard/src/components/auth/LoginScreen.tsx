/**
 * LoginScreen.tsx
 * Operator/admin sign-in. Generic error messaging (no user enumeration).
 */

import { useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api';
import {
  screenWrap, card, brandRow, title, subtitle, label, input,
  fieldGroup, primaryButton, linkButton, errorBox, colors,
} from './authStyles';

interface Props {
  onForgotPassword: () => void;
}

function messageForError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 423 || err.code === 'ACCOUNT_LOCKED') {
      return 'Too many failed attempts. Try again later or reset your password.';
    }
    if (err.status === 401 || err.code === 'INVALID_CREDENTIALS') {
      return 'Invalid email or password.';
    }
    if (err.status === 0 || err.status === undefined) {
      return 'Unable to reach the emergency operations API.';
    }
    return err.message;
  }
  // fetch() network failure
  return 'Unable to reach the emergency operations API.';
}

export function LoginScreen({ onForgotPassword }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
      // On success, AuthContext flips status → App renders the dashboard.
    } catch (err) {
      setError(messageForError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={screenWrap}>
      <form style={card} onSubmit={handleSubmit} noValidate>
        <div style={brandRow}>
          <span aria-hidden style={{ fontSize: 22 }}>🛰️</span>
          <h1 style={title}>ER Operations Dashboard</h1>
        </div>
        <p style={subtitle}>
          Secure sign-in for emergency operations personnel. Authorized use only.
        </p>

        {error && (
          <div style={errorBox} role="alert">
            {error}
          </div>
        )}

        <div style={fieldGroup}>
          <label htmlFor="login-email" style={label}>Email</label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            style={input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div style={fieldGroup}>
          <label htmlFor="login-password" style={label}>Password</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            style={input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          style={{ ...primaryButton, opacity: busy ? 0.7 : 1, marginTop: 4 }}
          disabled={busy}
        >
          {busy ? 'Signing in…' : 'Sign In'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button type="button" style={linkButton} onClick={onForgotPassword}>
            Forgot password?
          </button>
        </div>

        <p style={{ color: colors.textFaint, fontSize: 11, textAlign: 'center', marginTop: 22, lineHeight: 1.5 }}>
          DEMO SYSTEM — NOT A REPLACEMENT FOR 911. Pilot data only.
        </p>
      </form>
    </div>
  );
}
