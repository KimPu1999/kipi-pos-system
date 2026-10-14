<?php
namespace App\Http\Middleware;
use App\Support\StoreContext;
use Closure;
use Illuminate\Http\Request;
class AdminOnly
{
  public function handle(Request $request, Closure $next)
  {
    abort_unless(
      $request->user()->role === 'admin' || app(StoreContext::class)->usesPlatformAccess(),
      403,
      'Administrator access required.',
    );
    return $next($request);
  }
}
