<?php

namespace App\Http\Middleware;

use App\Support\PlatformPermissions;
use Closure;
use Illuminate\Http\Request;

final class RequirePlatformPermission
{
  public function handle(Request $request, Closure $next, string ...$permissions)
  {
    abort_unless(
      PlatformPermissions::all($request->user()->id, $permissions),
      403,
      'Platform permission required.',
    );

    return $next($request);
  }
}
