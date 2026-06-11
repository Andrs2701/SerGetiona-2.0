# Evolución Funcional 2026 — Estrategia de Pruebas, Plan de Regresión y Migración

> Cubre entregables: 13 (Plan de migración), 14 (Estrategia de pruebas), 15 (Plan de regresión).

---

## 1. Estado de testing previo (baseline)

- Backend: solo 2 tests placeholder (`ExampleTest`). `phpunit.xml` correcto: SQLite `:memory:` aislada de producción, listo para `RefreshDatabase`. Solo existía `UserFactory`.
- Frontend: sin framework de tests; gates = `eslint` + `tsc --noEmit` + `next build`.
- Conclusión: la suite de Feature tests de esta evolución es la primera red de seguridad real del proyecto.

## 2. Estrategia de pruebas para lo nuevo (Feature tests, `backend/tests/Feature/`)

| Test | Cubre |
|---|---|
| `AuthorizationMatrixTest` | Matriz rol × endpoint: operativos → 403 en endpoints gerenciales; admin/coordinator → 200; endpoints operativos legítimos (my-workspace, deliverables index filtrado, comments) siguen en 200 |
| `ActivityOwnershipTest` | update/quick-action: dueño 200, ajeno 403, admin/coord 200, revisor de cadena (rol siguiente) puede approve/request_adjustments |
| `EvidenceOwnershipTest` | dueño borra 200, ajeno 403, admin 200 |
| `CapacityReportTest` | cálculo exacto con complejidades conocidas; NULL usa default; operativo 403 |
| `ComplexityLevelTest` | CRUD solo admin; delete en uso → 409; entregable legacy NULL no rompe |
| `ProjectHealthTest` | umbrales configurables cambian el color; proyecto sin datos no da 500 |
| `MentionNotificationTest` | @usuario y @rol notifican; auto-mención no; comportamiento previo de comments intacto |
| `DecisionRecordTest` | CRUD gerencial; operativo 403 |
| `UserPreferenceTest` | preferencia por usuario aislada; default sin registro |
| `DashboardExtensionTest` | contrato de `/reports/dashboard` conserva TODAS las claves actuales |

Smoke manual mínimo post-deploy (10 min): login admin (dashboard sin 403, KPIs > 0) → login expert (`/`, `/mi-espacio`, `/calendario` sin errores en Network) → expert cambia estado y gestiona evidencia → coordinator crea entregable + quick-action + export → mención cruzada genera notificación → admin cambia umbral de salud y el semáforo reacciona.

## 3. Checklist de regresión completo

Credenciales de prueba en `Rol Correo Contraseña.txt` (todas `password`).

### Auth
- [ ] Login válido con cada uno de los 8 roles → redirige a `/`, token en localStorage.
- [ ] Login inválido → error visible. Logout → vuelve a `/login`.
- [ ] Recarga de página conserva sesión (`/auth/me`). Cambio de contraseña permite re-login.

### Dashboard admin (`/` como admin/coordinator)
- [ ] KPIs cargan de `/reports/dashboard` con números reales (no MOCK).
- [ ] Click en KPI «Vencidos» → SlidingPanel con `/reports/compliance` real.
- [ ] Tabla de carga (`/reports/workload`) responde 200.
- [ ] Tras el deploy: KPIs antiguos presentes con los mismos valores; secciones nuevas (Salud, Capacidad) renderizan.

### Dashboard operativo (`/` como expert/qa/design…)
- [ ] Renderiza `DashboardOperativo` con datos de `/my-workspace`.
- [ ] **Cero respuestas 403 en Network** (indicador #1 de que el hardening no rompió la UI operativa).
- [ ] Badge de vencidas del Sidebar coincide con stats.

### Mi Espacio (operativo)
- [ ] Lista actividades propias con stats.
- [ ] Cambiar estado de actividad propia → persiste al recargar (nota: antes de esta evolución la llamada iba a `/role-activities/{id}` inexistente y devolvía 404 — corregido en Fase 1).
- [ ] Agregar link de evidencia → 201 y aparece. **Borrar evidencia propia → 200.**
- [ ] Borrar evidencia ajena vía API → 403. Ver timeline → 200. Comentar → 201 + notificación al responsable.

### Proyectos
- [ ] Listar/crear/editar/eliminar como admin/coordinator → OK; crear como operativo vía API → 403 (sin cambio).
- [ ] Toggle Tabla ↔ Tarjetas persiste por usuario al recargar y no afecta a otros usuarios.

### Actividades / quick-actions
- [ ] Quick-action como coordinator → 200; approve notifica al siguiente rol de la cadena.
- [ ] PUT actividad propia (operativo) → 200. PUT actividad ajena → **403 (cambio deseado)**. Admin/coordinator → 200 siempre.
- [ ] Revisor de cadena (p.ej. pedagogy sobre actividad de expert del mismo entregable) puede approve/request_adjustments.
- [ ] Cambios generan AuditLog visible en timeline.

### Entregables
- [ ] Index como operativo devuelve SOLO entregables con actividad propia (filtro existente intacto).
- [ ] CUD como operativo vía API → **403 (cambio deseado)**; como coordinator → OK.
- [ ] Apply flow template, flow, export CSV → OK.
- [ ] Crear/editar entregable permite asignar nivel de complejidad; entregables viejos sin nivel funcionan igual.

### Calendario
- [ ] Operativo: `my-deliverables` + `calendar-events` 200, sin llamada a all-activities.
- [ ] Admin/coordinator: toggle «todas las actividades» → 200. Operativo vía API → **403 (cambio deseado)**.
- [ ] CUD de eventos: coordinator OK, operativo 403 (sin cambio). Suggest-dates abierto (sin cambio).

### Notificaciones
- [ ] Campana, marcar leída/todas, contadores → OK.
- [ ] Asignación de responsable y cambio de fecha siguen notificando.
- [ ] Mención @usuario genera notificación nueva sin afectar las anteriores.

### Usuarios / Roles / Permisos
- [ ] CRUD usuarios solo admin (sin cambio). Usuario desactivado no entra.
- [ ] Recorrer todas las páginas visibles del Sidebar con cada rol operativo: cero 403/500 en Network.
- [ ] Admin puede fijar capacidad semanal por usuario.

### Reportes / Import / Export
- [ ] `/reportes` como admin/coordinator → datos reales; vía API como operativo → **403 (cambio deseado)**.
- [ ] Import CSV + plantilla como coordinator → OK (nota: antes el modal apuntaba a localhost hardcodeado — corregido). Operativo vía API → 403.

### Historial / Comentarios / Evidencias
- [ ] Timeline con old/new tras editar. Hilos con respuestas anidadas + notificación al responsable. Evidencias agrupadas por rol en SidePanel.

### Módulos nuevos
- [ ] `/capacidad`, `/decisiones`: visibles solo para admin/coordinator; datos correctos; operativo vía URL directa no ve datos (403 silencioso).
- [ ] `/colaboracion`: todos los roles; mensajes, menciones, unread y last_read funcionan.
- [ ] `/configuracion`: niveles de complejidad CRUD y parámetros de salud/capacidad editables solo por admin; cambios afectan cálculo.

## 4. Plan de migración y despliegue

### Reglas
- Solo `Schema::create` y `ADD COLUMN` nullable. Nunca `->change()`, renames ni drops sobre tablas con datos (SQLite recrea la tabla en ALTER complejos).
- Seeders idempotentes (`firstOrCreate`) para complejidad y settings — seguros de re-ejecutar.
- Cada migración con `down()` simétrico.

### Verificación pre-deploy (espejo de producción, local)
```powershell
php artisan migrate:fresh --seed     # estado "producción actual"
# aplicar la rama nueva:
php artisan migrate --force          # SOLO migrate — debe pasar sin error sobre BD poblada
php artisan migrate:rollback --step=N ; php artisan migrate --force   # probar down()
php artisan test                     # suite completa verde
cd ../frontend ; npx tsc --noEmit ; npm run build
```

### Rollback
- **Código:** redeploy del commit anterior en Render. Todo es aditivo ⇒ el código viejo ignora tablas/columnas nuevas ⇒ **no hace falta revertir migraciones**. Camino recomendado.
- **BD:** con disco persistente, respaldar `database.sqlite` antes de cada deploy. Nunca `migrate:fresh`/`refresh` en producción.

### ⚠️ Bloqueante de infraestructura (acción del administrador de Render)
`render.yaml` no define `disk:` (plan free) y el CMD ejecuta `migrate + db:seed` en cada arranque ⇒ **la BD se regenera en cada deploy/restart**. Antes de usar Decisiones/Preferencias/Colaboración con datos reales:
1. Plan con disco persistente; montar p.ej. `/var/data`; `DB_DATABASE=/var/data/database.sqlite`.
2. CMD: `migrate --force` + seed **condicional** (solo si `User::count() === 0`).
3. Verificar post-deploy que datos creados sobreviven a un restart manual.

### Verificación post-deploy
1. Logs: migraciones nuevas «DONE», sin stacktrace; seed no corre sobre BD poblada.
2. `GET /api/auth/me` (admin) → 200. `/reports/dashboard`: admin 200 con claves antiguas + nuevas; expert 403.
3. Smoke manual §2. Network del frontend operativo sin ningún 403.
