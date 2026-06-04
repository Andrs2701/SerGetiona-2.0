const BASE_URL = 'http://localhost:8000/api';

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

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
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
  PROGRAMS: '/academic-programs',
  PROJECT_PROGRAMS: (projectId: number) => `/projects/${projectId}/academic-programs`,

  // Subjects
  PROGRAM_SUBJECTS: (programId: number) => `/academic-programs/${programId}/subjects`,

  // Deliverables
  DELIVERABLES: '/deliverables',
  PROJECT_DELIVERABLES: (projectId: number) => `/projects/${projectId}/deliverables`,
  DELIVERABLE: (id: number) => `/deliverables/${id}`,
  DELIVERABLE_COMMENTS: (id: number) => `/deliverables/${id}/comments`,

  // Role activities
  ROLE_ACTIVITY: (id: number) => `/role-activities/${id}`,

  // Users
  USERS: '/users',
  USER: (id: number) => `/users/${id}`,

  // Reports
  DASHBOARD: '/reports/dashboard',
  COMPLIANCE: '/reports/compliance',
  AUDIT: (projectId: number) => `/projects/${projectId}/audit`,
} as const;
