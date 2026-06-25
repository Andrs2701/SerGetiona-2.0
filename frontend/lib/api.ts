export const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('sergestiona_token');
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
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
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

async function requestForm<T>(method: string, path: string, body: FormData): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { method, headers, body });

  if (!res.ok) {
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
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export const api = {
  get: <T>(path: string) => request<unknown>('GET', path).then((r) => unwrap<T>(r)),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  postForm: <T>(path: string, body: FormData) => requestForm<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
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

  // Reports
  DASHBOARD: '/reports/dashboard',
  COMPLIANCE: '/reports/compliance',
  AUDIT: (projectId: number) => `/projects/${projectId}/audit`,

  // Workspace
  MY_WORKSPACE: '/my-workspace',

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
