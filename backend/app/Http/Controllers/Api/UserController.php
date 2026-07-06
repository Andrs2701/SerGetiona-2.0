<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Storage;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $users = User::query();

        if ($request->filled('role')) {
            $users->where('role', $request->role);
        }

        if ($request->filled('is_active')) {
            $users->where('is_active', $request->boolean('is_active'));
        }

        return UserResource::collection($users->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'role' => 'required|in:admin,coordinator,expert,pedagogy,design,audiovisual,engineering,qa',
            'is_active' => 'nullable|boolean',
            'phone' => 'nullable|string|max:30',
            'position' => 'nullable|string|max:255',
            'department' => 'nullable|string|max:255',
            'weekly_capacity_points' => 'nullable|integer|min:1|max:200',
        ]);

        $data['password'] = Hash::make($data['password']);

        $user = User::create($data);

        return new UserResource($user);
    }

    public function show(User $user)
    {
        return new UserResource($user);
    }

    public function update(Request $request, User $user)
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|unique:users,email,' . $user->id,
            'password' => 'nullable|string|min:8',
            'role' => 'sometimes|in:admin,coordinator,expert,pedagogy,design,audiovisual,engineering,qa',
            'is_active' => 'nullable|boolean',
            'phone' => 'nullable|string|max:30',
            'position' => 'nullable|string|max:255',
            'department' => 'nullable|string|max:255',
            'weekly_capacity_points' => 'nullable|integer|min:1|max:200',
        ]);

        if (isset($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        }

        $user->update($data);

        return new UserResource($user);
    }

    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'phone' => 'nullable|string|max:30',
            'position' => 'nullable|string|max:255',
            'department' => 'nullable|string|max:255',
        ]);

        $user->update($data);

        return new UserResource($user);
    }

    public function updatePhoto(Request $request)
    {
        $request->validate(['photo' => 'required|mimes:jpeg,png,jpg,webp|max:2048']);

        $user = $request->user();

        if ($user->photo_path) {
            Storage::disk('public')->delete($user->photo_path);
        }

        $path = $request->file('photo')->store('avatars', 'public');
        $user->update(['photo_path' => $path]);

        return new UserResource($user);
    }

    public function generateResetLink(Request $request, User $user)
    {
        $token = Password::createToken($user);

        AuditLog::create([
            'user_id'       => $request->user()->id,
            'action'        => 'password_reset_link_generated',
            'entity_type'   => 'User',
            'entity_id'     => $user->id,
            'field_changed' => null,
            'old_value'     => null,
            'new_value'     => null,
            'ip_address'    => $request->ip(),
            'created_at'    => now(),
        ]);

        return response()->json([
            'url'                => $user->passwordResetUrl($token),
            'expires_in_minutes' => (int) config('auth.passwords.users.expire'),
        ]);
    }

    public function destroy(Request $request, User $user)
    {
        if ($request->user()->is($user)) {
            return response()->json(['message' => 'No puedes eliminar tu propia cuenta.'], 422);
        }

        if ($user->role === 'admin') {
            return response()->json(['message' => 'No se puede eliminar la cuenta de administrador del sistema.'], 422);
        }

        $user->tokens()->delete();
        $user->delete();

        return response()->json(['message' => 'Usuario eliminado correctamente.']);
    }
}
