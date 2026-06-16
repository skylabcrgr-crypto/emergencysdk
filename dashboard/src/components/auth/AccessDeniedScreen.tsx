/**
 * AccessDeniedScreen.tsx
 * Shown when an authenticated user lacks the role required for a view.
 * Never crashes; offers a way back and a logout.
 */

import { useAuth } from '../../context/AuthContext';
import {
  screenWrap, card, brandRow, title, subtitle, primaryButton, secondaryButton, colors,
} from './authStyles';

interface Props {
  requiredRole?: string;
  onBack?: () => void;
}

export function AccessDeniedScreen({ requiredRole, onBack }: Props) {
  const { user, logout } = useAuth();

  return (
    <div style={screenWrap}>
      <div style={card}>
        <div style={brandRow}>
          <span aria-hidden style={{ fontSize: 22 }}>⛔</span>
          <h1 style={title}>Access denied</h1>
        </div>
        <p style={subtitle}>
          Your account{user?.role ? ` (${user.role})` : ''} doesn’t have permission to view this
          section{requiredRole ? `. It requires the ${requiredRole} role.` : '.'} If you believe this
          is an error, contact your system administrator.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          {onBack && (
            <button type="button" style={primaryButton} onClick={onBack}>
              Back to Operations
            </button>
          )}
          <button type="button" style={secondaryButton} onClick={() => void logout()}>
            Sign out
          </button>
        </div>
        <p style={{ color: colors.textFaint, fontSize: 11, marginTop: 20 }}>
          Signed in as {user?.email ?? 'unknown user'}.
        </p>
      </div>
    </div>
  );
}
