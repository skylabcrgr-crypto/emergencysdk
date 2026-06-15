/**
 * api.ts
 * Typed API client for the dashboard → backend communication.
 * All calls go through the Vite dev proxy (/api → localhost:3001).
 */

import type { ServerIncident, IncidentStatus } from './types';

const BASE = '/api/emergency';

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
  operatorNote?: string
): Promise<ServerIncident> {
  const data = await request<UpdateStatusResponse>(
    `/incidents/${id}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status, operatorNote }),
    }
  );
  return data.incident;
}
