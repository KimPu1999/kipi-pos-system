<?php

namespace App\Http\Controllers;

use App\Support\PlatformPermissions;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class StoreController
{
  public function index(Request $request)
  {
    if ($request->user()->role === 'admin') {
      $stores = DB::table('stores')
        ->join('store_memberships', 'store_memberships.store_id', '=', 'stores.id')
        ->where('store_memberships.user_id', $request->user()->id)
        ->where('store_memberships.role', 'admin')
        ->where('store_memberships.status', 'active')
        ->where('stores.status', 'active')
        ->get(['stores.id', 'stores.code', 'stores.name', 'stores.timezone', 'stores.currency']);
      abort_unless($stores->count() === 1, 409, 'Exactly one active store membership is required.');
      return response()->json($stores);
    }
    $query = DB::table('stores')->where('status', 'active')->orderBy('name');
    if (
      $request->user()->role !== 'customer' &&
      !$this->hasPlatformPermission($request->user()->id, 'platform.data.read_all')
    ) {
      $query->whereIn(
        'id',
        DB::table('store_memberships')
          ->where('user_id', $request->user()->id)
          ->where('status', 'active')
          ->pluck('store_id'),
      );
    }
    return response()->json($query->get(['id', 'code', 'name', 'timezone', 'currency']));
  }

  public function select(Request $request)
  {
    $data = $request->validate(['store_id' => 'required|integer']);
    abort_unless(
      DB::table('stores')->where('id', $data['store_id'])->where('status', 'active')->exists(),
      404,
    );
    if ($request->user()->role === 'admin') {
      $membership = DB::table('store_memberships')
        ->where('user_id', $request->user()->id)
        ->where('role', 'admin')
        ->where('status', 'active')
        ->get();
      abort_unless(
        $membership->count() === 1,
        409,
        'Exactly one active store membership is required.',
      );
      abort_unless((int) $membership->first()->store_id === (int) $data['store_id'], 403);
    } elseif ($request->user()->role !== 'customer') {
      $platform =
        $this->hasPlatformPermission($request->user()->id, 'platform.data.read_all') ||
        $this->hasPlatformPermission($request->user()->id, 'platform.data.write_all');
      abort_unless(
        $platform ||
          DB::table('store_memberships')
            ->where('user_id', $request->user()->id)
            ->where('store_id', $data['store_id'])
            ->where('status', 'active')
            ->exists(),
        403,
      );
    }
    $request->session()->put('store_id', (int) $data['store_id']);
    return response()->json(['store_id' => (int) $data['store_id']]);
  }

  private function hasPlatformPermission(int $userId, string $permission): bool
  {
    return PlatformPermissions::has($userId, $permission);
  }
}
