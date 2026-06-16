/**
 * SessionTimeoutModal.tsx
 * Inactivity-based session timeout. Warns the operator before logging them out
 * so an unattended console doesn't stay open in a public-safety environment.
 *
 * Only active when `enabled` (i.e. an authenticated, non-demo session).
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  colors, card, title, primaryButton, secondaryButton,
} from './authStyles';

interface Props {
  enabled: boolean;
  timeoutMinutes: number;
  warningMinutes: number;
  onTimeout: () => void;
}

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousemove', 'keydown', 'click', 'scroll', 'touchstart',
];

export function SessionTimeoutModal({ enabled, timeoutMinutes, warningMinutes, onTimeout }: Props) {
  const lastActivityRef = useRef<number>(Date.now());
  const [warning, setWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const timeoutMs = timeoutMinutes * 60_000;
  const warningMs = Math.min(warningMinutes, timeoutMinutes) * 60_000;

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    setWarning(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const onActivity = () => {
      // Don't auto-dismiss the warning on passive movement; only explicit "stay".
      if (!warning) lastActivityRef.current = Date.now();
    };
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));

    const interval = window.setInterval(() => {
      const idle = Date.now() - lastActivityRef.current;
      if (idle >= timeoutMs) {
        onTimeout();
      } else if (idle >= warningMs) {
        setWarning(true);
        setSecondsLeft(Math.ceil((timeoutMs - idle) / 1000));
      }
    }, 1000);

    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, onActivity));
      window.clearInterval(interval);
    };
  }, [enabled, warning, timeoutMs, warningMs, onTimeout]);

  if (!enabled || !warning) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="session-timeout-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 24,
      }}
    >
      <div style={{ ...card, maxWidth: 380 }}>
        <h2 id="session-timeout-title" style={{ ...title, fontSize: 18, marginBottom: 10 }}>
          Are you still there?
        </h2>
        <p style={{ color: colors.textDim, fontSize: 13, lineHeight: 1.5, marginBottom: 20 }}>
          Your session will expire in <strong style={{ color: colors.text }}>{secondsLeft}s</strong> due
          to inactivity. For security, you’ll be signed out automatically.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" style={primaryButton} onClick={resetActivity}>
            Stay signed in
          </button>
          <button type="button" style={secondaryButton} onClick={onTimeout}>
            Log out now
          </button>
        </div>
      </div>
    </div>
  );
}
