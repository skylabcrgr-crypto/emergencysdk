/**
 * api.ts
 * Typed API client for the dashboard → backend communication.
 * In development, Vite proxies /api → localhost:3001.
 * In production, VITE_API_BASE_URL points to the Railway server.
 */

import type { ServerIncident, IncidentStatus, EmergencyResourceRecord } from './types';

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const BASE = `${API_ORIGIN}/api/emergency`;

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
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
