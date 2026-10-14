<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\PlatformPermissions;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class PlatformAdminController
{
  public function me(Request $request)
  {
    $permissions = DB::table('user_permissions')
      ->join('permissions', 'permissions.id', '=', 'user_permissions.permission_id')
      ->where('user_permissions.user_id', $request->user()->id)
      ->where(
        fn($query) => $query
          ->whereNull('user_permissions.expires_at')
          ->orWhere('user_permissions.expires_at', '>', now()),
      )
      ->orderBy('permissions.key')
      ->pluck('permissions.key');

    return response()->json(['permissions' => $permissions]);
  }

  public function stores()
  {
    return response()->json(DB::table('stores')->orderBy('name')->get());
  }

  public function createStore(Request $request)
  {
    $data = $request->validate([
      'code' => 'required|string|max:50|alpha_dash|unique:stores,code',
      'name' => 'required|string|max:150',
      'timezone' => 'nullable|string|max:100',
      'currency' => 'nullable|string|size:3',
    ]);
    $storeId = DB::transaction(function () use ($data, $request) {
      $storeId = DB::table('stores')->insertGetId([
        'code' => strtoupper($data['code']),
        'name' => trim($data['name']),
        'status' => 'active',
        'timezone' => $data['timezone'] ?? 'Asia/Yangon',
        'currency' => strtoupper($data['currency'] ?? 'MMK'),
        'created_at' => now(),
        'updated_at' => now(),
      ]);
      $this->audit($request, $storeId, 'platform.store.created', 'store', $storeId);
      return $storeId;
    });
    return response()->json(DB::table('stores')->find($storeId), 201);
  }

  public function updateStore(Request $request, int $storeId)
  {
    $data = $request->validate([
      'name' => 'required|string|max:150',
      'status' => ['required', Rule::in(['active', 'inactive'])],
      'timezone' => 'required|string|max:100',
      'currency' => 'required|string|size:3',
    ]);
    abort_unless(DB::table('stores')->where('id', $storeId)->exists(), 404);
    DB::transaction(function () use ($data, $request, $storeId) {
      DB::table('stores')
        ->where('id', $storeId)
        ->update([...$data, 'currency' => strtoupper($data['currency']), 'updated_at' => now()]);
      $this->audit($request, $storeId, 'platform.store.updated', 'store', $storeId);
    });
    return response()->json(DB::table('stores')->find($storeId));
  }

  public function admins()
  {
    return response()->json(
      DB::table('store_memberships')
        ->join('stores', 'stores.id', '=', 'store_memberships.store_id')
        ->join('users', 'users.id', '=', 'store_memberships.user_id')
        ->where('store_memberships.role', 'admin')
        ->select(
          'store_memberships.id as membership_id',
          'store_memberships.status as membership_status',
          'users.id as user_id',
          'users.name as user_name',
          'users.email as user_email',
          'stores.id as store_id',
          'stores.code as store_code',
          'stores.name as store_name',
          'stores.status as store_status',
        )
        ->orderBy('stores.name')
        ->orderBy('users.name')
        ->get(),
    );
  }

  public function create(Request $request)
  {
    $data = $request->validate([
      'name' => 'required|string|max:100',
      'email' => 'required|string|email|max:254|unique:users,email',
      'password' => 'required|string|min:8|max:128|confirmed',
      'store_id' => 'nullable|required_without:store|integer',
      'store' => 'nullable|required_without:store_id|array',
      'store.code' => 'required_with:store|string|max:50|alpha_dash|unique:stores,code',
      'store.name' => 'required_with:store|string|max:150',
      'store.timezone' => 'nullable|string|max:100',
      'store.currency' => 'nullable|string|size:3',
    ]);

    $result = DB::transaction(function () use ($data, $request) {
      if (isset($data['store_id'])) {
        $store = DB::table('stores')
          ->where('id', $data['store_id'])
          ->where('status', 'active')
          ->lockForUpdate()
          ->first();
        if (!$store) {
          throw ValidationException::withMessages(['store_id' => 'Select an active store.']);
        }
        $storeId = $store->id;
      } else {
        $now = now();
        $storeId = DB::table('stores')->insertGetId([
          'code' => strtoupper($data['store']['code']),
          'name' => trim($data['store']['name']),
          'status' => 'active',
          'timezone' => $data['store']['timezone'] ?? 'Asia/Yangon',
          'currency' => strtoupper($data['store']['currency'] ?? 'MMK'),
          'created_at' => $now,
          'updated_at' => $now,
        ]);
      }

      $user = User::create([
        'name' => trim($data['name']),
        'email' => strtolower(trim($data['email'])),
        'password' => $data['password'],
      ]);
      $user->role = 'admin';
      $user->save();

      $membershipId = DB::table('store_memberships')->insertGetId([
        'store_id' => $storeId,
        'user_id' => $user->id,
        'role' => 'admin',
        'status' => 'active',
        'created_by' => $request->user()->id,
        'created_at' => now(),
        'updated_at' => now(),
      ]);
      DB::table('audit_events')->insert([
        'actor_user_id' => $request->user()->id,
        'store_id' => $storeId,
        'action' => 'platform.store_admin.created',
        'subject_type' => 'user',
        'subject_id' => $user->id,
        'metadata' => json_encode(['membership_id' => $membershipId]),
        'created_at' => now(),
      ]);

      return ['user_id' => $user->id, 'store_id' => $storeId, 'membership_id' => $membershipId];
    });

    return response()->json($result, 201);
  }

  public function updateMembership(Request $request, int $membershipId)
  {
    $data = $request->validate(['status' => ['required', Rule::in(['active', 'inactive'])]]);
    $membership = DB::table('store_memberships')
      ->where('id', $membershipId)
      ->where('role', 'admin')
      ->first();
    abort_unless($membership, 404);

    if ($data['status'] === 'active') {
      $alreadyActive = DB::table('store_memberships')
        ->where('user_id', $membership->user_id)
        ->where('role', 'admin')
        ->where('status', 'active')
        ->where('id', '!=', $membershipId)
        ->exists();
      abort_if($alreadyActive, 409, 'This administrator already has an active store membership.');
    }

    DB::transaction(function () use ($data, $membership, $membershipId, $request) {
      DB::table('store_memberships')
        ->where('id', $membershipId)
        ->update(['status' => $data['status'], 'updated_at' => now()]);
      DB::table('audit_events')->insert([
        'actor_user_id' => $request->user()->id,
        'store_id' => $membership->store_id,
        'action' => 'platform.store_admin.' . $data['status'],
        'subject_type' => 'store_membership',
        'subject_id' => $membershipId,
        'created_at' => now(),
      ]);
    });

    return response()->json(['membership_id' => $membershipId, 'status' => $data['status']]);
  }

  private function audit(
    Request $request,
    ?int $storeId,
    string $action,
    string $subjectType,
    int $subjectId,
  ): void {
    DB::table('audit_events')->insert([
      'actor_user_id' => $request->user()->id,
      'store_id' => $storeId,
      'action' => $action,
      'subject_type' => $subjectType,
      'subject_id' => $subjectId,
      'created_at' => now(),
    ]);
  }
}
