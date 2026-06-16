/**
 * CreateUserModal.tsx
 * Admin creates a new dashboard user. The generated (or supplied) temporary
 * password is shown ONCE after creation.
 */

import { useState, type FormEvent } from 'react';
import { createUser, ApiError, type CreateUserPayload, type ManagedUser } from '../../api';
import { evaluatePassword } from '../../auth/passwordPolicy';
import { PasswordStrengthMeter } from '../auth/PasswordStrengthMeter';
import {
  label, input, fieldGroup, primaryButton, secondaryButton, errorBox, colors,
} from '../auth/authStyles';
import { Modal } from './Modal';
import { TempPasswordReveal } from './TempPasswordReveal';

interface Props {
  onClose: () => void;
  onCreated: (user: ManagedUser) => void;
}

const ROLES: CreateUserPayload['role'][] = ['operator', 'viewer', 'agency_partner', 'admin'];

export function CreateUserModal({ onClose, onCreated }: Props) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<CreateUserPayload['role']>('operator');
  const [useCustomPassword, setUseCustomPassword] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ password: string; warning: string } | null>(null);
  const [createdUser, setCreatedUser] = useState<ManagedUser | null>(null);

  const customPwValid = !useCustomPassword || evaluatePassword(tempPassword, email.split('@')[0]).valid;
  const canSubmit = email.includes('@') && customPwValid && !busy;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const payload: CreateUserPayload = {
        email: email.trim(),
        role,
        ...(name.trim() ? { name: name.trim() } : {}),
        ...(useCustomPassword ? { temporaryPassword: tempPassword } : {}),
      };
      const res = await createUser(payload);
      setResult({ password: res.temporaryPassword, warning: res.warning });
      setCreatedUser(res.user);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_TAKEN') {
        setError('A user with that email already exists.');
      } else if (err instanceof ApiError && err.code === 'WEAK_PASSWORD') {
        setError(err.message);
      } else {
        setError('Could not create user. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Add user" onClose={onClose}>
      {result ? (
        <>
          <p style={{ color: colors.textDim, fontSize: 13, marginTop: 0, marginBottom: 14 }}>
            User <strong style={{ color: colors.text }}>{createdUser?.email}</strong> created.
          </p>
          <TempPasswordReveal password={result.password} warning={result.warning} />
          <button
            type="button"
            style={primaryButton}
            onClick={() => {
              if (createdUser) onCreated(createdUser);
              onClose();
            }}
          >
            Done
          </button>
        </>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          {error && <div style={errorBox} role="alert">{error}</div>}

          <div style={fieldGroup}>
            <label htmlFor="cu-email" style={label}>Email</label>
            <input id="cu-email" type="email" style={input} value={email}
              onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>

          <div style={fieldGroup}>
            <label htmlFor="cu-name" style={label}>Name (optional)</label>
            <input id="cu-name" type="text" style={input} value={name}
              onChange={(e) => setName(e.target.value)} />
          </div>

          <div style={fieldGroup}>
            <label htmlFor="cu-role" style={label}>Role</label>
            <select id="cu-role" style={{ ...input, appearance: 'auto' }} value={role}
              onChange={(e) => setRole(e.target.value as CreateUserPayload['role'])}>
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: colors.textDim, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={useCustomPassword}
              onChange={(e) => setUseCustomPassword(e.target.checked)} />
            Set a temporary password (otherwise one is generated)
          </label>

          {useCustomPassword && (
            <div style={fieldGroup}>
              <input type="text" style={input} value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                placeholder="Temporary password" autoComplete="off" />
              <div style={{ marginTop: 10 }}>
                <PasswordStrengthMeter password={tempPassword} emailLocalPart={email.split('@')[0]} />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button type="submit" style={{ ...primaryButton, opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? 'pointer' : 'not-allowed' }} disabled={!canSubmit}>
              {busy ? 'Creating…' : 'Create user'}
            </button>
            <button type="button" style={secondaryButton} onClick={onClose}>Cancel</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
