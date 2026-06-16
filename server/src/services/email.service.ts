/**
 * email.service.ts
 * Mock email provider.
 *
 * For the pilot, emails are logged (not sent). The raw reset URL is only
 * surfaced in development so it can be tested manually; in production the URL
 * (which contains the reset token) is NEVER logged.
 *
 * TODO (production): swap the mock body of `deliver()` for a real provider:
 *   - SendGrid:  @sendgrid/mail  → sgMail.send({...})
 *   - Postmark:  postmark        → client.sendEmail({...})
 *   - AWS SES:   @aws-sdk/client-ses → ses.send(new SendEmailCommand({...}))
 * Keep the function signatures below stable so callers don't change.
 */

import { env } from '../config/env';

const isDev = env.NODE_ENV === 'development';

interface EmailMessage {
  to: string;
  subject: string;
  /** Plain-text body. In dev only, may include the reset URL. */
  text: string;
}

/** Low-level "send". Mocked: logs a sanitized record. */
async function deliver(message: EmailMessage): Promise<void> {
  // TODO: replace with real provider call (SendGrid/Postmark/SES).
  console.log('[EMAIL:mock]', JSON.stringify({
    to: message.to,
    subject: message.subject,
    delivered: true,
    provider: 'mock',
  }));
  return Promise.resolve();
}

/**
 * Send a password reset email.
 * @returns the resetUrl ONLY in development (for manual testing); null otherwise.
 */
export async function sendPasswordResetEmail(params: {
  to: string;
  resetUrl: string;
}): Promise<{ devResetUrl: string | null }> {
  const { to, resetUrl } = params;

  await deliver({
    to,
    subject: 'Reset your ER Operations Dashboard password',
    // In production the body would contain resetUrl, but `deliver` does not log it.
    text: isDev
      ? `Reset your password (dev): ${resetUrl}\nThis link expires soon.`
      : 'Reset your password using the secure link that was emailed to you. This link expires soon.',
  });

  // Never expose the token-bearing URL outside development.
  return { devResetUrl: isDev ? resetUrl : null };
}

/**
 * Send a temporary-credentials email (admin-created accounts).
 * The temporary password is NOT included in the email body or logs; admins
 * deliver it out-of-band. This is a hook for a future "you've been invited" email.
 */
export async function sendAccountCreatedEmail(params: {
  to: string;
  name?: string | null;
}): Promise<void> {
  await deliver({
    to: params.to,
    subject: 'Your ER Operations Dashboard account is ready',
    text: 'An administrator created an account for you. Your temporary password was shared with you separately. Sign in and change it immediately.',
  });
}
