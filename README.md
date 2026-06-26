# SerGetiona 2.0

<div align="center">

![SerGetiona Banner](https://img.shields.io/badge/SerGetiona-2.0-0D6B72?style=for-the-badge)

**Enterprise-grade academic content production management platform**

Replaces fragmented Excel workflows with a centralized, traceable, role-based web application.

[![Laravel](https://img.shields.io/badge/Laravel-12-FF2D20?style=flat-square&logo=laravel&logoColor=white)](https://laravel.com)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PHP](https://img.shields.io/badge/PHP-8.2-777BB4?style=flat-square&logo=php&logoColor=white)](https://php.net)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://sqlite.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Render-46E3B7?style=flat-square&logo=render&logoColor=white)](https://sergestiona-2-0.onrender.com)

</div>

---

## 🎯 What Problem Does It Solve?

The School of Virtual Education (EEV) at Universidad Sergio Arboleda managed the production of 920+ academic content units using a massive Excel workbook with separate sheets per role — a system prone to data loss, version conflicts, and zero traceability.

**SerGetiona 2.0 replaced that entirely** with a multi-role web platform where each team member works in their own space, progress is tracked automatically, and managers get real-time dashboards without touching a spreadsheet.

---

## ✨ Key Features

### 🏗️ Core Platform
- **6-role workflow engine** — Expert → Pedagogy → Design → Audiovisual → Engineering → QA
- **Role-based dashboards** — each user sees only what's relevant to their role
- **45+ deliverables with 270 role-activities** pre-seeded with realistic production scenarios
- **Full audit log** — every state change is recorded automatically via `AuditObserver`

### 📊 Analytics & Reporting
- **Executive dashboard** — KPIs, program progress bars, bottleneck analysis, role ranking
- **Advanced filters** — filter by program, responsible, role, year and month; applied across Gantt and production tabs
- **Compliance reports** — on-time vs. overdue delivery tracking per program
- **Color-coded date indicators** — Green / Yellow / Red based on commitment deadlines

### 📅 Calendar & Scheduling
- **Monthly calendar** with Colombia public holidays (2025–2027) pre-loaded
- **Working day calculator** — `WorkingDayService` skips weekends and holidays when computing deadlines
- **Personal deliverable view** — each user sees their own upcoming commitments

### 🔄 Workflow Management
- **Visual sequential flow** — `DeliverableFlow` component shows current stage at a glance
- **Quick actions** — Deliver / Approve / Request Adjustments from the deliverables list; smart detection of which activity is actionable
- **Cross-role timeline** — unified event history per deliverable across all 6 roles
- **Comment threads** — Slack-style conversation per deliverable
- **Evidence panel** — links (Drive, SharePoint, external URLs) grouped by role in accordion
- **Production logging** — quantity tracking per resource type; N/A toggle to skip production requirement when not applicable
- **RoleActivity observer** — auto-sets `not_applicable` when responsible is removed; resets to `not_started` when reassigned

### 📦 Data Operations
- **CSV import** with preview modal and downloadable template
- **CSV export** for projects and deliverables
- **Internal notifications** with unread badge counter in header

### 🔐 Security & Auth
- **Laravel Sanctum** token-based authentication
- **Role-based access control** — 3 permission levels (Admin, Coordinator, Operative)
- **Password recovery flow** (SMTP-ready)

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Laravel 12, PHP 8.2, Laravel Sanctum |
| **Frontend** | Next.js 16, TypeScript, Tailwind CSS |
| **Database** | SQLite (dev) → PostgreSQL (production) |
| **UI Components** | TanStack Table, lucide-react, clsx |
| **Deployment** | Render (backend + frontend) |
| **Auth** | Bearer token via Laravel Sanctum |

---

## 📁 Project Structure

```
SerGetiona-2.0/
├── backend/                        # Laravel 12 API
│   ├── app/
│   │   ├── Http/Controllers/Api/   # 15 API controllers
│   │   ├── Models/                 # 12 Eloquent models
│   │   ├── Services/
│   │   │   ├── NotificationService.php
│   │   │   └── WorkingDayService.php
│   │   └── Observers/
│   │       ├── AuditObserver.php         # Automatic change tracking
│   │       └── RoleActivityObserver.php  # Auto not_applicable / not_started on responsible change
│   ├── database/
│   │   ├── migrations/             # 15 migrations
│   │   └── seeders/                # 8 users, 3 projects, 45 deliverables, 270 activities
│   └── routes/api.php
│
└── frontend/                       # Next.js 16 App Router
    ├── app/(dashboard)/
    │   ├── page.tsx                # Admin vs. Operative dashboard
    │   ├── proyectos/[id]/page.tsx # Excel-like project detail + 4-tab side panel
    │   ├── mi-espacio/page.tsx     # Personal workspace per role
    │   ├── calendario/page.tsx     # Monthly calendar with holidays
    │   └── reportes/page.tsx       # Compliance & analytics
    ├── components/
    │   ├── DeliverableFlow.tsx     # Visual sequential workflow
    │   ├── CommentThread.tsx       # Slack-style comments
    │   └── EvidencePanel.tsx       # Role-grouped evidence links
    └── lib/
        ├── api.ts                  # Fetch client with auto-unwrap
        └── types.ts                # Full TypeScript type definitions
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+ and npm
- PHP 8.2+ and Composer
- No Docker required

### 1. Clone the repository
```bash
git clone https://github.com/Andrs2701/SerGetiona-2.0.git
cd SerGetiona-2.0
```

### 2. Backend setup
```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate:fresh --seed
php artisan db:seed --class=CalendarEventSeeder
php artisan serve
# Backend available at http://localhost:8000
```

### 3. Frontend setup
```bash
cd frontend
npm install
npm run dev
# Frontend available at http://localhost:3000
```

### Demo credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@sergestiona.com | Set via `DEMO_USER_PASSWORD` env var |
| Coordinator | coordinator@sergestiona.com | Same as above |
| Operative (Expert) | expert@sergestiona.com | Same as above |

> Credentials are seeded automatically. Password is configured via environment variable only — never stored in source code.

---

## 🗂️ Data Model

```
Project
 └── AcademicProgram
      └── Subject
           └── Deliverable (Week 0, Module 1, etc.)
                └── RoleActivity × 6 roles
                     ├── expert
                     ├── pedagogy
                     ├── design
                     ├── audiovisual
                     ├── engineering
                     └── qa
```

### Database snapshot (seeded)

| Table | Records |
|-------|---------|
| users | 8 |
| projects | 3 |
| academic_programs | 4 |
| subjects | ~12 |
| deliverables | 45 |
| role_activities | 270 |
| calendar_events | 52 holidays (Colombia 2025–2027) |

---

## 🔌 API Reference (Key Endpoints)

```
POST   /api/auth/login
GET    /api/auth/me
GET    /api/my-workspace                    # Role-personalized dashboard data
GET    /api/projects
GET    /api/projects/{id}
GET    /api/deliverables/{id}/flow          # Sequential workflow state
POST   /api/activities/{id}/quick-action   # deliver|approve|request_adjustments|reject
GET    /api/reports/dashboard               # Executive KPIs + program breakdown
GET    /api/reports/compliance              # On-time delivery compliance
GET    /api/calendar-events?year=2026
POST   /api/import/deliverables             # Bulk CSV import
GET    /api/export/deliverables             # CSV export with filters
```

---

## 🗺️ Roadmap

- [x] Role-based authentication and permissions
- [x] Full deliverable workflow (6 stages)
- [x] Executive and operative dashboards
- [x] Calendar with Colombian holidays
- [x] Internal notifications system
- [x] CSV import / export
- [x] Audit log for all changes
- [x] Cross-role timeline per deliverable
- [x] Production logging with N/A option
- [x] Advanced dashboard filters (program, responsible, role, year, month)
- [x] Gantt view (TabSeguimiento) for admin/coordinator
- [x] Smart quick-action buttons (Deliver / Approve) in deliverables list
- [ ] PDF export
- [ ] Real file uploads (currently external URLs only)
- [ ] Email notifications via SMTP
- [ ] Kanban view
- [ ] PostgreSQL migration for production
- [ ] Docker deployment setup

---

## 👤 Author

**Camilo Andrés Chitiva Castelblanco**
- LinkedIn: [linkedin.com/in/andres-chitiva-204a4b259](https://linkedin.com/in/andres-chitiva-204a4b259)
- GitHub: [@Andrs2701](https://github.com/Andrs2701)
- Email: andrscc2701@gmail.com

*Built for the School of Virtual Education — Universidad Sergio Arboleda, Bogotá, Colombia.*

---

<div align="center">

⭐ If this project helped you or you found it interesting, please consider giving it a star.

</div>
