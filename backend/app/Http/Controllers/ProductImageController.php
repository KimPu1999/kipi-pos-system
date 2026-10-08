<?php
namespace App\Http\Controllers;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
class ProductImageController
{
  public function show(int $id)
  {
    $p = DB::table('products')->find($id);
    abort_unless($p && $p->image_path, 404);
    abort_unless(Storage::disk('local')->exists($p->image_path), 404);
    return response()->file(Storage::disk('local')->path($p->image_path), [
      'Cache-Control' => 'private, no-cache',
      'X-Content-Type-Options' => 'nosniff',
    ]);
  }
}
