<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\UserPreference;
use Illuminate\Http\Request;

class PreferenceController extends Controller
{
    public function show(Request $request)
    {
        $pref = UserPreference::firstOrCreate(
            ['user_id' => $request->user()->id],
            UserPreference::DEFAULT_PREFERENCES
        );
        return response()->json(['preferences' => $pref]);
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'portfolio_view'               => 'nullable|in:table,cards,timeline',
            'right_sidebar_open'           => 'nullable|boolean',
            'email_notifications_enabled'  => 'nullable|boolean',
            'email_tasks'                   => 'nullable|boolean',
            'email_chat'                    => 'nullable|boolean',
            'email_deadlines'               => 'nullable|boolean',
            'entregables_view'              => 'nullable|in:rows,grouped',
        ]);

        $pref = UserPreference::updateOrCreate(
            ['user_id' => $request->user()->id],
            array_filter($data, fn ($v) => $v !== null)
        );

        return response()->json(['preferences' => $pref]);
    }
}
