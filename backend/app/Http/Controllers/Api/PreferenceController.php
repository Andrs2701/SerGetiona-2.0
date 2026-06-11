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
            ['portfolio_view' => 'table']
        );
        return response()->json(['preferences' => $pref]);
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'portfolio_view' => 'nullable|in:table,cards,timeline',
        ]);

        $pref = UserPreference::updateOrCreate(
            ['user_id' => $request->user()->id],
            array_filter($data, fn ($v) => $v !== null)
        );

        return response()->json(['preferences' => $pref]);
    }
}
