<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class RoleActivity extends Model
{
    use HasFactory;

    protected $fillable = [
        'deliverable_id',
        'role',
        'responsible_id',
        'assigned_by',
        'assigned_at',
        'commitment_date',
        'actual_start_date',
        'actual_delivery_date',
        'status',
        'notes',
        'checklist',
        'production_not_applicable',
    ];

    protected $casts = [
        'assigned_at'               => 'datetime',
        'commitment_date'           => 'date',
        'actual_start_date'         => 'date',
        'actual_delivery_date'      => 'date',
        'checklist'                 => 'array',
        'production_not_applicable' => 'boolean',
    ];

    /**
     * Estados que cuentan como "completado" para % de cumplimiento/avance: se
     * considera terminado el trabajo del responsable en cuanto entrega, sin
     * esperar a que un gestor la apruebe formalmente. Fuente única reutilizada
     * en dashboards, reportes y resumen ejecutivo — antes existían al menos 8
     * variantes de este mismo cálculo divergiendo entre sí. Constante (no solo
     * scope) para poder reutilizarla también al filtrar colecciones ya
     * cargadas en memoria, no solo en el query builder.
     *
     * Ojo: 'in_review' salió de aquí al unificarse los verbos de trabajo en
     * 'in_progress'. No confundir con deliverables.global_status = 'in_review',
     * que es otro vocabulario y sigue vigente (ver recalculateGlobalStatus()).
     */
    public const COMPLETED_STATUSES = ['approved', 'delivered'];

    /**
     * Estados que NO cuentan como "activo"/en curso: ni las que aún no
     * arrancan (not_started) ni las que ya se entregaron/aprobaron/no aplican.
     */
    public const INACTIVE_STATUSES = ['approved', 'delivered', 'not_applicable', 'not_started'];

    /**
     * Estados que excluyen a una actividad de contar como vencida: una vez
     * entregada/aprobada/no aplicable, deja de estar vencida sin importar
     * cuánto tiempo tome la revisión posterior.
     */
    public const NOT_OVERDUE_STATUSES = ['approved', 'delivered', 'not_applicable'];

    /**
     * Actividades vencidas: con fecha de compromiso pasada, sin entrega registrada
     * y en un estado que aún espera acción del responsable. Una vez que
     * actual_delivery_date queda registrado (deliver/approve), la actividad deja
     * de contar como vencida sin importar cuánto tiempo tome la revisión posterior.
     */
    public function scopeOverdue($query)
    {
        return $query->whereNotNull('commitment_date')
            ->where('commitment_date', '<', now()->toDateString())
            ->whereNull('actual_delivery_date')
            ->whereNotIn('status', self::NOT_OVERDUE_STATUSES);
    }

    public function scopeCompleted($query)
    {
        return $query->whereIn('status', self::COMPLETED_STATUSES);
    }

    /**
     * Actividades "activas" (en curso).
     */
    public function scopeActive($query)
    {
        return $query->whereNotIn('status', self::INACTIVE_STATUSES);
    }

    public static function defaultChecklist(string $role): array
    {
        return match($role) {
            'pedagogy'    => ['entrega_pedagogia' => false, 'multimedia' => false, 'descargable' => false, 'actividades' => false, 'guiones' => false],
            'design'      => ['entrega_diseno' => false, 'multimedia' => false, 'descargable' => false, 'banners' => false],
            'audiovisual' => ['entrega_audiovisual' => false, 'videos' => false, 'videos_animados' => false, 'video_podcast' => false],
            'engineering' => ['entrega_ingenieria' => false, 'act_evaluativas' => false, 'act_interactivas' => false],
            'qa'          => ['entrega_calidad' => false],
            default       => [],
        };
    }

    public function deliverable()
    {
        return $this->belongsTo(Deliverable::class);
    }

    public function responsible()
    {
        return $this->belongsTo(User::class, 'responsible_id');
    }

    public function assignedBy()
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }

    public function evidences()
    {
        return $this->hasMany(Evidence::class);
    }

    public function evidenceLinks()
    {
        return $this->hasMany(EvidenceLink::class);
    }

    public function productionLogs()
    {
        return $this->hasMany(ProductionLog::class);
    }

    public function observations()
    {
        return $this->hasMany(RoleActivityObservation::class, 'role_activity_id');
    }
}
