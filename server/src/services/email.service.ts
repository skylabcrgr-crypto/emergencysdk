/**
 * email.service.ts
 * Transactional email via Resend (https://resend.com).
 *
 * Behaviour:
 *   RESEND_API_KEY set   → sends real email via Resend
 *   RESEND_API_KEY unset → mock mode (console log only, no network call)
 *
 * The reset URL (contains a secret token) is NEVER logged in production.
 * It is returned to the caller as devResetUrl ONLY in NODE_ENV=development.
 */

import { env } from '../config/env';

const isDev = env.NODE_ENV === 'development';

// Lazy singleton — only imported when the key exists so tests / mock mode
// have no dependency on the resend package at runtime.
let _resend: import('resend').Resend | null = null;

async function getResend(): Promise<import('resend').Resend | null> {
  if (!env.RESEND_API_KEY) return null;
  if (!_resend) {
    const { Resend } = await import('resend');
    _resend = new Resend(env.RESEND_API_KEY);
  }
  return _resend;
}

// ─── HTML templates ───────────────────────────────────────────────────────────

function resetHtml(resetUrl: string, expiryMin: number): string {
  return `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:540px;margin:32px auto;color:#1a1a1a">
  <h2>Reset your password</h2>
  <p>A password reset was requested for your ER Operations Dashboard account.</p>
  <p>
    <a href="${resetUrl}"
       style="display:inline-block;background:#2f6fed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">
      Reset password
    </a>
  </p>
  <p style="color:#666;font-size:13px">
    This link expires in ${expiryMin} minutes.<br>
    If you did not request a password reset, you can safely ignore this email.
  </p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
  <p style="color:#999;font-size:11px">DEMO SYSTEM — NOT A REPLACEMENT FOR 911. Do not use for real emergencies.</p>
</body>
</html>`;
}

function accountCreatedHtml(name?: string | null): string {
  const greeting = name ? `Hi ${name},` : 'Hello,';
  return `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:540px;margin:32px auto;color:#1a1a1a">
  <h2>Your dashboard account is ready</h2>
  <p>${greeting}</p>
  <p>An administrator has created an ER Operations Dashboard account for you.</p>
  <p>Your temporary password was shared with you separately by your administrator.<br>
     Sign in and change it immediately.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
  <p style="color:#999;font-size:11px">DEMO SYSTEM — NOT A REPLACEMENT FOR 911. Do not use for real emergencies.</p>
</body>
</html>`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Send a password-reset email.
 * @returns devResetUrl — the reset URL only in development (for manual testing); null in production.
 */
export async function sendPasswordResetEmail(params: {
  to: string;
  resetUrl: string;
}): Promise<{ devResetUrl: string | null }> {
  const { to, resetUrl } = params;
  const resend = await getResend();

  if (resend) {
    const { error } = await resend.emails.send({
      from: env.RESEND_FROM,
      to,
      subject: 'Reset your ER Operations Dashboard password',
      html: resetHtml(resetUrl, env.PASSWORD_RESET_TOKEN_TTL_MINUTES),
    });
    if (error) {
      // Log the error kind but never the token-bearing URL.
      const e = error as { name: string; message: string };
      console.error('[EMAIL:resend] password-reset delivery error:', e.name, e.message);
    } else {
      console.log('[EMAIL:resend] password-reset sent to:', to);
    }
  } else {
    // Mock — sanitised log, never logs the token URL in production.
    console.log('[EMAIL:mock]', JSON.stringify({ to, subject: 'password-reset', provider: 'mock' }));
    if (isDev) console.log('[EMAIL:mock] devResetUrl:', resetUrl);
  }

  return { devResetUrl: isDev ? resetUrl : null };
}

/**
 * Send a welcome email when an admin creates a new account.
 * The temporary password is NOT included — admins deliver it out-of-band.
 */
export async function sendAccountCreatedEmail(params: {
  to: string;
  name?: string | null;
}): Promise<void> {
  const { to, name } = params;
  const resend = await getResend();

  if (resend) {
    const { error } = await resend.emails.send({
      from: env.RESEND_FROM,
      to,
      subject: 'Your ER Operations Dashboard account is ready',
      html: accountCreatedHtml(name),
    });
    if (error) {
      const e = error as { name: string; message: string };
      console.error('[EMAIL:resend] account-created delivery error:', e.name, e.message);
    } else {
      console.log('[EMAIL:resend] account-created sent to:', to);
    }
  } else {
    console.log('[EMAIL:mock]', JSON.stringify({ to, subject: 'account-created', provider: 'mock' }));
  }
}
