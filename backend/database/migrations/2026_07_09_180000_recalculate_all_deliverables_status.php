<?php

use Illuminate\Database\Migrations\Migration;
use App\Models\Deliverable;
use App\Http\Controllers\Api\RoleActivityController;

return new class extends Migration
{
    /**
     * Correr recálculo de estado global para todos los entregables.
     */
    public function up(): void
    {
        $deliverables = Deliverable::all();
        foreach ($deliverables as $deliverable) {
            RoleActivityController::recalculateGlobalStatus($deliverable);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No requiere revertirse
    }
};
