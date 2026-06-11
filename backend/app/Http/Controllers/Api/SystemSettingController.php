<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\SystemSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class SystemSettingController extends Controller
{
    /**
     * GET /settings?group=health|capacity
     */
    public function index(Request $request)
    {
        $query = SystemSetting::orderBy('group')->orderBy('key');

        if ($request->filled('group')) {
            $query->where('group', $request->group);
        }

        return response()->json(['settings' => $query->get()]);
    }

    /**
     * PUT /settings
     * body: { values: { "health.weight_overdue": 35, ... } }
     * Solo actualiza claves existentes (sembradas) — no crea settings nuevos.
     */
    public function update(Request $request)
    {
        $data = $request->validate([
            'values'   => 'required|array|min:1',
            'values.*' => 'required|numeric|min:0|max:10000',
        ]);

        $updated = [];

        foreach ($data['values'] as $key => $value) {
            $setting = SystemSetting::where('key', $key)->first();
            if (!$setting) {
                continue;
            }

            $old = $setting->value;
            $setting->update(['value' => (string) $value]);
            SystemSetting::flushCache($key);

            if ($old !== (string) $value) {
                AuditLog::create([
                    'user_id'      => Auth::id(),
                    'action'       => 'updated',
                    'entity_type'  => 'SystemSetting',
                    'entity_id'    => $setting->id,
                    'field_changed'=> $key,
                    'old_value'    => $old,
                    'new_value'    => (string) $value,
                    'ip_address'   => $request->ip(),
                    'created_at'   => now(),
                ]);
            }

            $updated[] = $key;
        }

        return response()->json(['updated' => $updated]);
    }
}
