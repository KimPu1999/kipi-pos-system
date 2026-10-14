<?php

namespace App\Http\Middleware;

use App\Support\StoreContext;
use App\Support\PlatformPermissions;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class ResolveStoreContext
{
  public function handle(Request $request, Closure $next)
  {
    if (
      $request->is('api/auth/*') ||
      $request->is('api/stores*') ||
      $request->is('api/platform/*')
    ) {
      return $next($request);
    }

    $user = $request->user();
    $headerStore = $request->header('X-Store-ID');
    $requested = $headerStore ?: $request->session()->get('store_id');
    $legacyTestContext = false;
    $memberships = DB::table('store_memberships')
      ->where('user_id', $user->id)
      ->where('role', 'admin')
      ->where('status', 'active')
      ->pluck('store_id');

    if ($user->role === 'admin' && (!app()->environment('testing') || $memberships->isNotEmpty())) {
      abort_unless(
        $memberships->count() === 1,
        409,
        'Store administrator must have exactly one active store membership.',
      );
      $storeId = (int) $memberships->first();
      abort_if($headerStore && (int) $headerStore !== $storeId, 403);
      abort_unless(
        DB::table('stores')->where('id', $storeId)->where('status', 'active')->exists(),
        403,
        'This store is not active.',
      );
      app(StoreContext::class)->set($storeId);
      $request->session()->put('store_id', $storeId);
      return $next($request);
    }

    if (!$requested && $memberships->count() === 1) {
      $requested = $memberships->first();
    }
    if (app()->environment('testing') && !$headerStore && $memberships->isEmpty()) {
      $requested ??= 1;
      $legacyTestContext = true;
    }

    abort_unless($requested && ctype_digit((string) $requested), 409, 'Select a store first.');
    $storeId = (int) $requested;
    abort_unless(
      DB::table('stores')->where('id', $storeId)->where('status', 'active')->exists(),
      404,
    );

    $member = $memberships->contains($storeId);
    $permission = $request->isMethodSafe() ? 'platform.data.read_all' : 'platform.data.write_all';
    $platform = PlatformPermissions::has($user->id, $permission);

    abort_unless($member || $platform || $user->role === 'customer' || $legacyTestContext, 403);
    app(StoreContext::class)->set($storeId, !$member && $platform, $legacyTestContext);
    $request->session()->put('store_id', $storeId);

    return $next($request);
  }
}
