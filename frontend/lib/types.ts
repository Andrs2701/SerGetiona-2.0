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
  weekly_capacity_points?: number | null;
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
  project_id?: number;
  project_name?: string;
  compliance_percentage?: number;
  complexity_level_id?: number | null;
  complexity?: { id: number; name: string; points: number } | null;
}

export interface Comment {
  id: number;
  deliverable_id: number;
  user: User;
  parent_id?: number;
  content: string;
  created_at: string;
}

export interface ProgramBreakdown {
  id: number;
  name: string;
  project_id: number;
  project_name: string;
  total: number;
  finished: number;
  compliance_percentage: number;
  overdue_count: number;
  active_count: number;
  pending_count: number;
}

export interface ActivityByRoleDetail {
  role: Role;
  total: number;
  approved: number;
  active: number;
  overdue: number;
}

export interface DashboardStats {
  active_projects: number;
  total_programs: number;
  total_deliverables: number;
  total_activities: number;
  finished_deliverables: number;
  finished_activities: number;
  active_activities: number;
  with_observations: number;
  compliance_percentage: number;
  global_compliance_percentage: number;
  overdue_activities: number;
  approaching_activities: number;
  deliverables_by_status: Record<string, number>;
  activities_by_role_detail: ActivityByRoleDetail[];
  programs_breakdown: ProgramBreakdown[];
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

export const ROLE_STATUS_LABELS: Record<string, string> = {
  not_started: 'Sin Iniciar',
  draft: 'Borrador',
  in_development: 'En Desarrollo',
  delivered: 'Entregado',
  adjustments_requested: 'Ajustes Solicitados',
  approved: 'Aprobado',
  not_applicable: 'No Aplica',
  in_progress: 'En Progreso',
  in_review: 'En Revisión',
  adjusting: 'Ajustando',
  designing: 'Diseñando',
  production: 'Producción',
  editing: 'Edición',
  implementing: 'Implementando',
  validating: 'Validando',
  pending: 'Pendiente',
  in_testing: 'En Pruebas',
  with_findings: 'Con Hallazgos',
  with_observations: 'Con Observaciones',
  rejected: 'Rechazado',
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

export interface TimelineEvent {
  type: 'created' | 'assigned' | 'status' | 'delivered' | 'date_changed' | 'note' | 'approved';
  icon: string;
  label: string;
  user?: string | null;
  date?: string;
  role?: string;
  role_label?: string;
}

export interface WorkspaceActivity {
  id: number;
  role: Role;
  status: string;
  notes?: string;
  commitment_date?: string;
  actual_start_date?: string;
  actual_delivery_date?: string;
  date_status: DateStatus;
  deliverable: { id: number; name: string; type: DeliverableType; semestre?: string; ciclo?: string } | null;
  subject: { id: number; name: string } | null;
  program: { id: number; name: string } | null;
  project: { id: number; name: string; status: ProjectStatus } | null;
  next_role?: Role;
  next_responsible?: string;
  next_date?: string;
}

export interface EvidenceLink {
  id: number;
  role_activity_id: number;
  type: 'file' | 'url' | 'drive' | 'onedrive' | 'sharepoint' | 'repository';
  title: string;
  url?: string;
  filename?: string;
  user?: User;
  created_at: string;
}

export interface EvidenceByRole {
  expert: EvidenceLink[];
  pedagogy: EvidenceLink[];
  design: EvidenceLink[];
  audiovisual: EvidenceLink[];
  engineering: EvidenceLink[];
  qa: EvidenceLink[];
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

// ── Evolución 2026: complejidad, capacidad, salud, decisiones, colaboración ──

export interface ComplexityLevel {
  id: number;
  name: string;
  points: number;
  is_active: boolean;
  sort_order: number;
}

export interface SystemSetting {
  id: number;
  key: string;
  value: string;
  label: string;
  group: string;
}

export type CapacityStatus = 'ok' | 'high' | 'overloaded';

export interface CapacityUser {
  user_id: number;
  user_name: string;
  role: UserRole;
  capacity_points: number;
  active_points: number;
  active_activities: number;
  overdue: number;
  utilization_pct: number;
  status: CapacityStatus;
}

export interface CapacityRole {
  role: UserRole;
  users: number;
  capacity_points: number;
  active_points: number;
  utilization_pct: number;
  overloaded_users: number;
}

export interface CapacitySummary {
  capacity_points: number;
  active_points: number;
  available_points: number;
  utilization_pct: number;
  overloaded_users: number;
  status: CapacityStatus;
}

export interface CapacityTrendPoint {
  week_start: string;
  active_points: number;
  capacity_points: number;
  utilization_pct: number;
  overdue: number;
}

export interface ReassignmentSuggestion {
  user_id: number;
  name: string;
  utilization_pct: number;
  active_points: number;
  capacity_points: number;
  utilization_after: number;
}

export type HealthLevel = 'green' | 'yellow' | 'red';

export interface HealthFactor {
  key: string;
  label: string;
  raw: number;
  weight: number;
  penalty: number;
}

export interface ProjectHealth {
  project_id: number;
  project_name: string;
  score: number;
  level: HealthLevel;
  factors: HealthFactor[];
}

export interface HealthReport {
  portfolio_score: number;
  portfolio_level: HealthLevel;
  projects: ProjectHealth[];
}

export type DecisionStatus = 'pending' | 'in_progress' | 'implemented' | 'cancelled';
export type DecisionImpact = 'low' | 'medium' | 'high';

export interface DecisionRecord {
  id: number;
  decision_date: string;
  project_id?: number | null;
  academic_program_id?: number | null;
  description: string;
  responsible_id?: number | null;
  status: DecisionStatus;
  impact: DecisionImpact;
  observations?: string | null;
  responsible?: User | null;
  project?: { id: number; name: string } | null;
  program?: { id: number; name: string } | null;
  created_at?: string;
}

export interface Channel {
  id: number;
  name: string;
  type: 'general' | 'project' | 'program';
  project_id?: number | null;
  academic_program_id?: number | null;
  is_archived: boolean;
  is_private?: boolean;
  unread_count?: number;
  member_count?: number;
  last_message_at?: string | null;
  project?: { id: number; name: string } | null;
  program?: { id: number; name: string } | null;
}

export interface ChannelMember {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

export interface ChannelMessage {
  id: number;
  channel_id: number;
  parent_id?: number | null;
  content: string;
  user: { id: number; name: string; role: UserRole };
  created_at: string;
  replies?: ChannelMessage[];
}

export type PortfolioView = 'table' | 'cards' | 'timeline';

export interface UserPreferences {
  portfolio_view?: PortfolioView;
  right_sidebar_open?: boolean;
}

// ── Configuración avanzada dinámica ──────────────────────────────────────────

export interface SystemRole {
  slug: string;
  name: string;
  description?: string | null;
  is_active: boolean;
}

export interface SystemPermission {
  id: number;
  module: string;
  action: string;
  view_path?: string | null;
  allowed_roles: string[];
  description?: string | null;
}

export interface SystemStatus {
  id: number;
  type: 'deliverable' | 'task';
  slug: string;
  label: string;
  color?: string | null;
  description?: string | null;
  is_active: boolean;
}

export interface StateTransition {
  id: number;
  type: 'deliverable' | 'task';
  from_status: string;
  to_status: string;
  allowed_roles: string[];
}

export interface VisibilityRule {
  id: number;
  role_slug: string;
  scope: 'all' | 'assigned_only';
}

// ── Tipos de recurso y producción ──────────────────────────────────────────

export interface ResourceType {
  id: number;
  role: Role;
  name: string;
  slug: string;
  description?: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface ProductionLog {
  id: number;
  role_activity_id: number;
  resource_type_id: number;
  quantity: number;
  description?: string | null;
  produced_by: number;
  logged_by: number;
  produced_at: string;
  resource_type?: ResourceType;
  producer?: { id: number; name: string };
  created_at?: string;
}

export interface ProductionSummary {
  totals: { total_records: number; total_quantity: number; unique_producers: number };
  by_type: Array<{ resource_type: string; role: string; total: number }>;
  by_role: Array<{ role: string; records: number; total: number }>;
  by_user: Array<{ user_id: number; user_name: string; user_role: string; total: number; records: number }>;
  by_project: Array<{ project_id: number; project_name: string; total: number; records: number }>;
}

export interface DeliverableFlowRole {
  role: string;
  activity_id: number;
  status: string;
  notes?: string;
  commitment_date?: string;
  actual_delivery_date?: string;
  responsible?: { id: number; name: string };
  production: { resource_type: string; total: number; logs: { quantity: number; produced_at?: string; producer?: string }[] }[];
  links: { id: number; type: string; title: string; url?: string; user?: { name: string }; created_at: string }[];
}

export interface DeliverableFlow {
  deliverable: { id: number; name: string };
  roles: DeliverableFlowRole[];
}

export const HEALTH_LEVEL_LABELS: Record<HealthLevel, string> = {
  green: 'Saludable',
  yellow: 'Con alertas',
  red: 'Crítico',
};

export const CAPACITY_STATUS_LABELS: Record<CapacityStatus, string> = {
  ok: 'Disponible',
  high: 'Ocupación alta',
  overloaded: 'Sobrecargado',
};

export const DECISION_STATUS_LABELS: Record<DecisionStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En Progreso',
  implemented: 'Implementada',
  cancelled: 'Cancelada',
};

export const DECISION_IMPACT_LABELS: Record<DecisionImpact, string> = {
  low: 'Bajo',
  medium: 'Medio',
  high: 'Alto',
};
