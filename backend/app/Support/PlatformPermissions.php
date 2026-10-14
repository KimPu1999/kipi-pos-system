<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

final class PlatformPermissions
{
  public static function has(int $userId, string $permission): bool
  {
    return DB::table('user_permissions')
      ->join('permissions', 'permissions.id', '=', 'user_permissions.permission_id')
      ->where('user_permissions.user_id', $userId)
      ->where('permissions.key', $permission)
      ->where(
        fn($query) => $query
          ->whereNull('user_permissions.expires_at')
          ->orWhere('user_permissions.expires_at', '>', now()),
      )
      ->exists();
  }

  public static function any(int $userId, array $permissions): bool
  {
    foreach ($permissions as $permission) {
      if (self::has($userId, $permission)) {
        return true;
      }
    }
    return false;
  }

  public static function all(int $userId, array $permissions): bool
  {
    foreach ($permissions as $permission) {
      if (!self::has($userId, $permission)) {
        return false;
      }
    }
    return $permissions !== [];
  }
}
