export const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('sergestiona_token');
}

// Rutas donde un 401 es un resultado esperado (credenciales invalidas, o
// la verificacion inicial de sesion) — no deben disparar la redireccion
// automatica de "sesion expirada", cada una ya maneja su propio 401.
const SKIP_EXPIRED_REDIRECT = ['/auth/login', '/auth/me'];

function handleUnauthorized(path: string) {
  if (SKIP_EXPIRED_REDIRECT.includes(path)) return;
  if (typeof window === 'undefined') return;
  localStorage.removeItem('sergestiona_token');
  localStorage.removeItem('sergestiona_user');
  // El layout del dashboard también redirige a /login (sin query param) en cuanto
  // detecta que ya no hay sesión, en una carrera con esta navegación dura — por
  // eso el aviso de "sesión expirada" no depende solo del query param, sino de
  // este flag en sessionStorage que sobrevive sin importar cuál navegación gane.
  sessionStorage.setItem('sergestiona_session_expired', '1');
  window.location.href = '/sergestiona/login?expired=1';
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // Sin esto, Laravel no considera la petición como "espera JSON" y en un 401
    // intenta redirigir a la ruta nombrada "login" (que no existe en esta API) en
    // vez de responder 401 en JSON — eso producía un 500 en vez del 401 esperado.
    'Accept': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    if (res.status === 401) handleUnauthorized(path);
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

async function requestForm<T>(method: string, path: string, body: FormData): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Accept': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { method, headers, body });

  if (!res.ok) {
    if (res.status === 401) handleUnauthorized(path);
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// Unwrap Laravel's { data: [...] } envelope when present
function unwrap<T>(response: unknown): T {
  if (
    response !== null &&
    typeof response === 'object' &&
    'data' in response &&
    !('token' in response) &&
    !('user' in response) &&
    !('count' in response) &&
    !('stats' in response)
  ) {
    return (response as { data: T }).data;
  }
  return response as T;
}

export async function downloadCsv(path: string, filename: string): Promise<void> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('sergestiona_token') : null;
  const headers: Record<string, string> = { 'Accept': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  if (!res.ok) {
    if (res.status === 401) handleUnauthorized(path);
    throw new Error(`HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export const api = {
  get: <T>(path: string) => request<unknown>('GET', path).then((r) => unwrap<T>(r)),
  post: <T>(path: string, body: unknown) => request<unknown>('POST', path, body).then((r) => unwrap<T>(r)),
  postForm: <T>(path: string, body: FormData) => requestForm<unknown>('POST', path, body).then((r) => unwrap<T>(r)),
  put: <T>(path: string, body: unknown) => request<unknown>('PUT', path, body).then((r) => unwrap<T>(r)),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

// Endpoint constants
export const ENDPOINTS = {
  // Auth
  LOGIN: '/auth/login',

  // Projects
  PROJECTS: '/projects',
  PROJECT: (id: number) => `/projects/${id}`,

  // Programs
  PROGRAMS: '/programs',
  PROJECT_PROGRAMS: (projectId: number) => `/programs?project_id=${projectId}`,

  // Subjects
  PROGRAM_SUBJECTS: (programId: number) => `/subjects?academic_program_id=${programId}`,

  // Deliverables
  DELIVERABLES: '/deliverables',
  PROJECT_DELIVERABLES: (projectId: number) => `/deliverables?project_id=${projectId}`,
  DELIVERABLE: (id: number) => `/deliverables/${id}`,
  DELIVERABLE_COMMENTS: (id: number) => `/deliverables/${id}/comments`,

  // Role activities
  ROLE_ACTIVITY: (id: number) => `/activities/${id}`,

  // Users
  USERS: '/users',
  USER: (id: number) => `/users/${id}`,
  PROFILE: '/profile',
  PROFILE_PHOTO: '/profile/photo',

  // Reports
  DASHBOARD: '/reports/dashboard',
  COMPLIANCE: '/reports/compliance',
  AUDIT: (projectId: number) => `/projects/${projectId}/audit`,

  // Workspace
  MY_WORKSPACE: '/my-workspace',

  // Preferences
  PREFERENCES: '/preferences',

  // Notifications
  NOTIFICATIONS: '/notifications',
  NOTIFICATION_UNREAD_COUNT: '/notifications/unread-count',
  NOTIFICATION_READ: (id: number) => `/notifications/${id}/read`,
  NOTIFICATION_READ_ALL: '/notifications/read-all',

  // Calendar
  CALENDAR_EVENTS: '/calendar-events',
  CALENDAR_MY_DELIVERABLES: '/calendar/my-deliverables',
  CALENDAR_SUGGEST_DATES: '/calendar/suggest-dates',
  CALENDAR_ALL_ACTIVITIES: '/calendar/all-activities',
  CALENDAR_MY_DECISIONS: '/calendar/my-decisions',

  // Decisions
  DECISION_STATUS: (id: number) => `/decisions/${id}/status`,

  // Import / Export
  IMPORT_TEMPLATE: '/import/template',
  IMPORT_DELIVERABLES: '/import/deliverables',
  EXPORT_PROJECTS: '/export/projects',
  EXPORT_DELIVERABLES: '/export/deliverables',

  // Evidence & quick actions
  DELIVERABLE_EVIDENCE: (id: number) => `/deliverables/${id}/evidence`,
  ACTIVITY_EVIDENCE: (id: number) => `/role-activities/${id}/evidence`,
  ACTIVITY_QUICK_ACTION: (id: number) => `/activities/${id}/quick-action`,
  ACTIVITY_TIMELINE: (id: number) => `/activities/${id}/timeline`,
  DELIVERABLE_TIMELINE: (id: number) => `/deliverables/${id}/timeline`,
  DELIVERABLE_FLOW: (id: number) => `/deliverables/${id}/flow`,

  // Resource types & production
  RESOURCE_TYPES: '/resource-types',
  ACTIVITY_PRODUCTION: (id: number) => `/activities/${id}/production`,
  PRODUCTION_SUMMARY: '/reports/production',
  EXPORT_PRODUCTION: '/export/production',

  // Auth extended
  AUTH_ME: '/auth/me',
  AUTH_LOGOUT: '/auth/logout',
  FORGOT_PASSWORD: '/auth/forgot-password',
  RESET_PASSWORD: '/auth/reset-password',
  CHANGE_PASSWORD: '/auth/change-password',
} as const;
