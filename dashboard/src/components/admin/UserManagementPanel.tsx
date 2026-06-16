/**
 * UserManagementPanel.tsx
 * Admin-only directory of dashboard users with create/edit/deactivate/
 * reactivate/reset-password actions.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  listUsers, deactivateUser, reactivateUser, ApiError, type ManagedUser,
} from '../../api';
import { colors } from '../auth/authStyles';
import { UserRoleBadge } from './UserRoleBadge';
import { CreateUserModal } from './CreateUserModal';
import { EditUserModal } from './EditUserModal';
import { ResetUserPasswordModal } from './ResetUserPasswordModal';

const th: React.CSSProperties = {
  textAlign: 'left',
  color: colors.textFaint,
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0.6,
  padding: '10px 12px',
  borderBottom: `1px solid ${colors.border}`,
};

const td: React.CSSProperties = {
  padding: '12px',
  borderBottom: `1px solid ${colors.border}`,
  color: colors.text,
  fontSize: 13,
  verticalAlign: 'middle',
};

const actionBtn: React.CSSProperties = {
  background: 'none',
  border: `1px solid ${colors.border}`,
  color: colors.textDim,
  borderRadius: 6,
  padding: '5px 10px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export function UserManagementPanel() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [resetting, setResetting] = useState<ManagedUser | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await listUsers());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const upsert = (u: ManagedUser) =>
    setUsers((prev) => {
      const exists = prev.some((p) => p.id === u.id);
      return exists ? prev.map((p) => (p.id === u.id ? u : p)) : [u, ...prev];
    });

  async function handleDeactivate(user: ManagedUser) {
    if (!window.confirm('Deactivate this user? They will lose dashboard access immediately.')) return;
    setActionError(null);
    try {
      upsert(await deactivateUser(user.id));
    } catch (err) {
      setActionError(
        err instanceof ApiError && err.code === 'LAST_ADMIN'
          ? 'You cannot deactivate the last remaining admin.'
          : 'Could not deactivate user.'
      );
    }
  }

  async function handleReactivate(user: ManagedUser) {
    setActionError(null);
    try {
      upsert(await reactivateUser(user.id));
    } catch {
      setActionError('Could not reactivate user.');
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h2 style={{ color: colors.text, fontSize: 18, margin: 0 }}>User management</h2>
          <p style={{ color: colors.textDim, fontSize: 13, margin: '4px 0 0' }}>
            Manage dashboard operators, viewers, agency partners, and admins.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          style={{
            backgroundColor: colors.accent, color: '#fff', border: 'none',
            borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}
        >
          + Add user
        </button>
      </div>

      {actionError && (
        <div style={{ color: '#ffb4b6', backgroundColor: colors.dangerBg, border: `1px solid ${colors.danger}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, marginBottom: 14 }} role="alert">
          {actionError}
        </div>
      )}

      <div style={{ backgroundColor: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 24, color: colors.textDim, fontSize: 14 }}>Loading users…</div>
        ) : error ? (
          <div style={{ padding: 24, color: '#ffb4b6', fontSize: 14 }}>{error}</div>
        ) : users.length === 0 ? (
          <div style={{ padding: 24, color: colors.textDim, fontSize: 14 }}>No users found.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>User</th>
                <th style={th}>Role</th>
                <th style={th}>Status</th>
                <th style={th}>Last login</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ opacity: u.isActive ? 1 : 0.55 }}>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{u.name || u.email}</div>
                    {u.name && <div style={{ color: colors.textFaint, fontSize: 12 }}>{u.email}</div>}
                  </td>
                  <td style={td}><UserRoleBadge role={u.role} /></td>
                  <td style={td}>
                    <span style={{ color: u.isActive ? colors.success : colors.textFaint, fontWeight: 600 }}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ ...td, color: colors.textDim }}>{formatDate(u.lastLoginAt)}</td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button type="button" style={actionBtn} onClick={() => setEditing(u)}>Edit</button>
                      <button type="button" style={actionBtn} onClick={() => setResetting(u)}>Reset PW</button>
                      {u.isActive ? (
                        <button type="button" style={{ ...actionBtn, color: colors.danger, borderColor: colors.danger }} onClick={() => void handleDeactivate(u)}>
                          Deactivate
                        </button>
                      ) : (
                        <button type="button" style={{ ...actionBtn, color: colors.success, borderColor: colors.success }} onClick={() => void handleReactivate(u)}>
                          Reactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateUserModal onClose={() => setShowCreate(false)} onCreated={upsert} />
      )}
      {editing && (
        <EditUserModal user={editing} onClose={() => setEditing(null)} onSaved={upsert} />
      )}
      {resetting && (
        <ResetUserPasswordModal user={resetting} onClose={() => setResetting(null)} />
      )}
    </div>
  );
}
