<?php
namespace App\Http\Controllers;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
class WishlistNotificationController
{
  public function index(Request $r)
  {
    $rows = DB::table('wishlist_notifications')
      ->join('products', 'products.id', '=', 'wishlist_notifications.product_id')
      ->where('wishlist_notifications.user_id', $r->user()->id)
      ->orderByDesc('wishlist_notifications.id')
      ->limit(50)
      ->get([
        'wishlist_notifications.id',
        'wishlist_notifications.product_id',
        'wishlist_notifications.type',
        'wishlist_notifications.customer_count',
        'wishlist_notifications.read_at',
        'wishlist_notifications.created_at',
        'products.name as product_name',
        'products.emoji as product_emoji',
        'products.category as product_category',
      ]);
    return response()->json([
      'unread' => (int) DB::table('wishlist_notifications')
        ->where('user_id', $r->user()->id)
        ->whereNull('read_at')
        ->count(),
      'notifications' => $rows->map(function ($n) {
        $n->read_at = $n->read_at
          ? \Illuminate\Support\Carbon::parse($n->read_at, 'UTC')->toIso8601String()
          : null;
        $n->created_at = \Illuminate\Support\Carbon::parse(
          $n->created_at,
          'UTC',
        )->toIso8601String();
        return $n;
      }),
    ]);
  }
  public function read(Request $r)
  {
    DB::table('wishlist_notifications')
      ->where('user_id', $r->user()->id)
      ->whereNull('read_at')
      ->update(['read_at' => now()]);
    return response()->json(['unread' => 0]);
  }
}