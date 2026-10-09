<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WishlistController
{
  public function index(Request $r)
  {
    $ids = DB::table('wishlists')
      ->where('user_id', $r->user()->id)
      ->orderByDesc('id')
      ->pluck('product_id');
    return response()->json($ids->values()->all());
  }
  public function store(Request $r, int $product)
  {
    if (!DB::table('products')->where('id', $product)->exists()) {
      abort(404, 'Product not found.');
    }
    DB::table('wishlists')->insertOrIgnore([
      'user_id' => $r->user()->id,
      'product_id' => $product,
      'created_at' => now(),
      'updated_at' => now(),
    ]);
    return response()->json(['ok' => true]);
  }
  public function destroy(Request $r, int $product)
  {
    DB::table('wishlists')
      ->where('user_id', $r->user()->id)
      ->where('product_id', $product)
      ->delete();
    return response()->json(['ok' => true]);
  }
}