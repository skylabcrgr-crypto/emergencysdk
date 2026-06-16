/**
 * api.ts
 * Typed API client for the dashboard → backend communication.
 * In development, Vite proxies /api → localhost:3001.
 * In production, VITE_API_BASE_URL points to the Railway server.
 */

import type { ServerIncident, IncidentStatus, EmergencyResourceRecord } from './types';

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';

// ─── Auth token (JWT Bearer) ───────────────────────────────────────────────────
// Stored in sessionStorage so it clears when the tab closes.
// TODO (production): move to httpOnly, Secure, SameSite cookies set by the
//   backend instead of JS-readable storage, to mitigate XSS token theft.

const TOKEN_KEY = 'er_auth_token';

export function getAuthToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setAuthToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* sessionStorage unavailable — ignore */
  }
}

export function isAuthenticated(): boolean {
  return getAuthToken() !== null;
}

// Auth state listeners — the AuthContext subscribes so a 401 anywhere
// (e.g. expired token mid-session) routes the user back to login.
type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

function emitUnauthorized(): void {
  for (const l of unauthorizedListeners) l();
}

// ─── Normalized API error ──────────────────────────────────────────────────────

export interface NormalizedError {
  message: string;
  status?: number;
  code?: string;
}

export class ApiError extends Error implements NormalizedError {
  status?: number;
  code?: string;
  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

interface BackendErrorShape {
  error?: string | { message?: string; code?: string };
  message?: string;
}

function toApiError(status: number, body: BackendErrorShape | undefined): ApiError {
  let message = `Request failed (HTTP ${status})`;
  let code: string | undefined;
  if (body) {
    if (typeof body.error === 'string') {
      message = body.error;
    } else if (body.error && typeof body.error === 'object') {
      message = body.error.message ?? message;
      code = body.error.code;
    } else if (typeof body.message === 'string') {
      message = body.message;
    }
  }
  return new ApiError(message, status, code);
}

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  lastLoginAt?: string | null;
}

// ─── Core fetch ────────────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Low-level fetch against an absolute path under API_ORIGIN. */
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_ORIGIN}${path}`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    ...options,
  });

  if (res.status === 401) {
    setAuthToken(null);
    emitUnauthorized();
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => undefined)) as BackendErrorShape | undefined;
    throw toApiError(res.status, body);
  }

  // 204 / empty body tolerance
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

/** Emergency-API helper (prefixes /api/emergency). */
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  return apiFetch<T>(`/api/emergency${path}`, options);
}

// ─── Auth API ───────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_ORIGIN}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json().catch(() => undefined)) as
    | { token?: string; user?: AuthUser }
    | BackendErrorShape
    | undefined;
  if (!res.ok || !(body as { token?: string })?.token) {
    throw toApiError(res.status, body as BackendErrorShape);
  }
  const ok = body as { token: string; user: AuthUser };
  setAuthToken(ok.token);
  return ok.user;
}

export async function logout(): Promise<void> {
  // Best-effort server audit; always clear the local token.
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch {
    /* ignore — token is cleared below regardless */
  }
  setAuthToken(null);
}

/** Clears the token locally without a network call (used on hard 401). */
export function clearAuthLocal(): void {
  setAuthToken(null);
}

export async function getCurrentUser(): Promise<AuthUser> {
  return apiFetch<AuthUser>('/api/auth/me');
}

export async function forgotPassword(email: string): Promise<{ message: string; devResetUrl?: string }> {
  return apiFetch('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await apiFetch('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiFetch('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

// ─── Admin user management API ───────────────────────────────────────────────────

export interface ManagedUser {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserPayload {
  email: string;
  name?: string;
  role: 'admin' | 'operator' | 'viewer' | 'agency_partner';
  temporaryPassword?: string;
}

export interface UpdateUserPayload {
  name?: string;
  role?: 'admin' | 'operator' | 'viewer' | 'agency_partner';
  isActive?: boolean;
}

export async function listUsers(): Promise<ManagedUser[]> {
  const data = await apiFetch<{ users: ManagedUser[] }>('/api/admin/users');
  return data.users;
}

export async function createUser(
  payload: CreateUserPayload
): Promise<{ user: ManagedUser; temporaryPassword: string; warning: string }> {
  return apiFetch('/api/admin/users', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateUser(id: string, payload: UpdateUserPayload): Promise<ManagedUser> {
  const data = await apiFetch<{ user: ManagedUser }>(`/api/admin/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return data.user;
}

export async function deactivateUser(id: string): Promise<ManagedUser> {
  const data = await apiFetch<{ user: ManagedUser }>(`/api/admin/users/${id}/deactivate`, {
    method: 'POST',
  });
  return data.user;
}

export async function reactivateUser(id: string): Promise<ManagedUser> {
  const data = await apiFetch<{ user: ManagedUser }>(`/api/admin/users/${id}/reactivate`, {
    method: 'POST',
  });
  return data.user;
}

export async function resetUserPassword(
  id: string
): Promise<{ temporaryPassword: string; warning: string }> {
  return apiFetch(`/api/admin/users/${id}/reset-password`, { method: 'POST' });
}

// ─── Incidents ────────────────────────────────────────────────────────────────

interface IncidentListResponse {
  success: boolean;
  count: number;
  incidents: ServerIncident[];
}

interface IncidentDetailResponse {
  success: boolean;
  incident: ServerIncident;
}

interface UpdateStatusResponse {
  success: boolean;
  incident: ServerIncident;
  message: string;
}

export async function fetchIncidents(filters?: {
  status?: IncidentStatus[];
  type?: string[];
}): Promise<ServerIncident[]> {
  const params = new URLSearchParams();
  if (filters?.status?.length) params.set('status', filters.status.join(','));
  if (filters?.type?.length) params.set('type', filters.type.join(','));

  const query = params.toString() ? `?${params}` : '';
  const data = await request<IncidentListResponse>(`/incidents${query}`);
  return data.incidents;
}

export async function fetchIncident(id: string): Promise<ServerIncident> {
  const data = await request<IncidentDetailResponse>(`/incidents/${id}`);
  return data.incident;
}

export async function updateIncidentStatus(
  id: string,
  status: IncidentStatus,
  operatorNote?: string,
  operatorId?: string
): Promise<ServerIncident> {
  const data = await request<UpdateStatusResponse>(
    `/incidents/${id}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status, operatorNote, operatorId }),
    }
  );
  return data.incident;
}

interface NoteResponse { success: boolean; incident: ServerIncident }
interface AssignResponse { success: boolean; incident: ServerIncident }

export async function addOperatorNote(
  id: string,
  note: string,
  operatorId?: string
): Promise<ServerIncident> {
  const data = await request<NoteResponse>(
    `/incidents/${id}/note`,
    { method: 'PATCH', body: JSON.stringify({ note, operatorId }) }
  );
  return data.incident;
}

export async function updateIncidentAssignment(
  id: string,
  assignedOperatorId: string | null,
  assignedAgency: string | null,
  operatorId?: string
): Promise<ServerIncident> {
  const data = await request<AssignResponse>(
    `/incidents/${id}/assign`,
    { method: 'PATCH', body: JSON.stringify({ assignedOperatorId, assignedAgency, operatorId }) }
  );
  return data.incident;
}

// ─── Resources ────────────────────────────────────────────────────────────────

interface ResourceListResponse {
  success: boolean;
  count: number;
  resources: EmergencyResourceRecord[];
}

export async function fetchResources(filters?: {
  type?: string;
  county?: string;
}): Promise<EmergencyResourceRecord[]> {
  const params = new URLSearchParams();
  if (filters?.type)   params.set('type', filters.type);
  if (filters?.county) params.set('county', filters.county);
  const query = params.toString() ? `?${params}` : '';
  const data = await request<ResourceListResponse>(`/resources${query}`);
  return data.resources;
}
