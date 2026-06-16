/**
 * EditUserModal.tsx
 * Admin edits a user's name, role, and active status.
 */

import { useState, type FormEvent } from 'react';
import { updateUser, ApiError, type ManagedUser, type UpdateUserPayload } from '../../api';
import {
  label, input, fieldGroup, primaryButton, secondaryButton, errorBox, colors,
} from '../auth/authStyles';
import { Modal } from './Modal';

interface Props {
  user: ManagedUser;
  onClose: () => void;
  onSaved: (user: ManagedUser) => void;
}

const ROLES: UpdateUserPayload['role'][] = ['operator', 'viewer', 'agency_partner', 'admin'];

export function EditUserModal({ user, onClose, onSaved }: Props) {
  const [name, setName] = useState(user.name ?? '');
  const [role, setRole] = useState<NonNullable<UpdateUserPayload['role']>>(
    (user.role as UpdateUserPayload['role']) ?? 'operator'
  );
  const [isActive, setIsActive] = useState(user.isActive);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const payload: UpdateUserPayload = {
        name: name.trim(),
        role,
        isActive,
      };
      const updated = await updateUser(user.id, payload);
      onSaved(updated);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'LAST_ADMIN') {
        setError('You cannot demote or deactivate the last remaining admin.');
      } else {
        setError('Could not save changes. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Edit user" onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        {error && <div style={errorBox} role="alert">{error}</div>}

        <p style={{ color: colors.textDim, fontSize: 13, marginTop: 0, marginBottom: 16 }}>
          {user.email}
        </p>

        <div style={fieldGroup}>
          <label htmlFor="eu-name" style={label}>Name</label>
          <input id="eu-name" type="text" style={input} value={name}
            onChange={(e) => setName(e.target.value)} />
        </div>

        <div style={fieldGroup}>
          <label htmlFor="eu-role" style={label}>Role</label>
          <select id="eu-role" style={{ ...input, appearance: 'auto' }} value={role}
            onChange={(e) => setRole(e.target.value as NonNullable<UpdateUserPayload['role']>)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, color: colors.textDim, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)} />
          Account active (can sign in)
        </label>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" style={{ ...primaryButton, opacity: busy ? 0.7 : 1 }} disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
          <button type="button" style={secondaryButton} onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
