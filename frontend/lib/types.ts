export type ProjectStatus =
  | 'draft'
  | 'pending_params'
  | 'parameterized'
  | 'in_progress'
  | 'suspended'
  | 'finished'
  | 'cancelled';

export type DeliverableType = 'creation' | 'update';

export type GlobalStatus =
  | 'unpublished'
  | 'pending_start'
  | 'in_progress'
  | 'in_review'
  | 'with_observations'
  | 'finished'
  | 'cancelled'
  | 'not_applicable';

export type Role =
  | 'expert'
  | 'pedagogy'
  | 'design'
  | 'audiovisual'
  | 'engineering'
  | 'qa';

export type UserRole =
  | 'admin'
  | 'coordinator'
  | 'expert'
  | 'pedagogy'
  | 'design'
  | 'audiovisual'
  | 'engineering'
  | 'qa';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  phone?: string;
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  status: ProjectStatus;
  responsible?: User;
  start_date?: string;
  end_date?: string;
  programs_count: number;
  deliverables_count: number;
  compliance_percentage: number;
  created_at: string;
}

export interface AcademicProgram {
  id: number;
  project_id: number;
  name: string;
  code?: string;
  subjects_count?: number;
  deliverables_count?: number;
}

export interface Subject {
  id: number;
  academic_program_id: number;
  name: string;
  code?: string;
  deliverables_count?: number;
}

export interface RoleActivity {
  id: number;
  deliverable_id: number;
  role: Role;
  responsible?: User;
  commitment_date?: string;
  actual_start_date?: string;
  actual_delivery_date?: string;
  status: string;
  notes?: string;
}

export interface Deliverable {
  id: number;
  subject_id: number;
  name: string;
  type: DeliverableType;
  global_status: GlobalStatus;
  start_date?: string;
  notes?: string;
  role_activities?: RoleActivity[];
  // enriched fields for table views
  subject_name?: string;
  program_name?: string;
  program_id?: number;
  project_name?: string;
  compliance_percentage?: number;
}

export interface Comment {
  id: number;
  deliverable_id: number;
  user: User;
  parent_id?: number;
  content: string;
  created_at: string;
}

export interface DashboardStats {
  active_projects: number;
  total_programs: number;
  total_deliverables: number;
  with_observations: number;
  compliance_percentage: number;
}

export interface ComplianceReport {
  projects: Array<{
    id: number;
    name: string;
    compliance: number;
    total: number;
    approved: number;
    delayed: number;
  }>;
  by_status: Record<GlobalStatus, number>;
  by_role: Array<{
    role: Role;
    on_time: number;
    delayed: number;
  }>;
  global_compliance: number;
  total_approved: number;
  total_delayed: number;
}

// Label translations
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: 'Borrador',
  pending_params: 'Pend. Parametrización',
  parameterized: 'Parametrizado',
  in_progress: 'En Ejecución',
  suspended: 'Suspendido',
  finished: 'Finalizado',
  cancelled: 'Cancelado',
};

export const GLOBAL_STATUS_LABELS: Record<GlobalStatus, string> = {
  unpublished: 'Sin publicar',
  pending_start: 'Pend. Inicio',
  in_progress: 'En Ejecución',
  in_review: 'En Revisión',
  with_observations: 'Con Observaciones',
  finished: 'Finalizado',
  cancelled: 'Cancelado',
  not_applicable: 'No Aplica',
};

export const ROLE_LABELS: Record<Role, string> = {
  expert: 'Experto',
  pedagogy: 'Pedagogía',
  design: 'Diseño',
  audiovisual: 'Audiovisual',
  engineering: 'Ingeniería',
  qa: 'Calidad',
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  coordinator: 'Coordinador',
  expert: 'Experto',
  pedagogy: 'Pedagogía',
  design: 'Diseño',
  audiovisual: 'Audiovisual',
  engineering: 'Ingeniería',
  qa: 'Calidad',
};

export const DELIVERABLE_TYPE_LABELS: Record<DeliverableType, string> = {
  creation: 'Creación',
  update: 'Actualización',
};

export type DateStatus = 'on_time' | 'approaching' | 'overdue' | 'completed' | 'not_applicable';

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read_at?: string;
  created_at: string;
}

export interface CalendarEvent {
  id: number;
  name: string;
  date: string;
  type: 'holiday' | 'non_working' | 'vacation' | 'closure' | 'event';
  description?: string;
  is_recurring: boolean;
}

export interface WorkspaceActivity {
  id: number;
  role: Role;
  status: string;
  commitment_date?: string;
  actual_delivery_date?: string;
  date_status: DateStatus;
  deliverable: { id: number; name: string; type: DeliverableType };
  subject: { id: number; name: string };
  program: { id: number; name: string };
  project: { id: number; name: string; status: ProjectStatus };
}

export interface WorkspaceStats {
  pending: number;
  approaching: number;
  overdue: number;
  completed: number;
}

export interface Workspace {
  user: User;
  role: UserRole;
  stats: WorkspaceStats;
  activities: WorkspaceActivity[];
  calendar_activities: WorkspaceActivity[];
}
