<?php
namespace App\Http\Controllers;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
class PromotionController
{
  private function present(object $p): object
  {
    $p->product_ids = $p->product_ids ? json_decode($p->product_ids, true) : [];
    $p->categories = $p->categories ? json_decode($p->categories, true) : [];
    return $p;
  }
  private function normalizeScope(Request $r): void
  {
    foreach (['product_ids', 'categories'] as $key) {
      if (is_string($r->input($key))) {
        $r->merge([$key => json_decode($r->input($key), true)]);
      }
    }
  }

  public function index(Request $r)
  {
    $q = DB::table('promotions')->whereNull('deleted_at')->orderByDesc('id');
    if ($r->user()->role !== 'admin') {
      $q->where('active', true)->where(
        fn($q) => $q->whereNull('expires_on')->orWhere('expires_on', '>=', now()->toDateString()),
      );
    }
    return response()->json($q->get()->map(fn($p) => $this->present($p)));
  }
  public function store(Request $r)
  {
    $this->normalizeScope($r);
    $r->merge(['code' => strtoupper(trim((string) $r->input('code')))]);
    if (!$r->filled('code')) {
      $r->merge([
        'code' =>
          'PROMO-' . strtoupper(str_replace('-', '', (string) \Illuminate\Support\Str::uuid())),
      ]);
    }
    $d = $r->validate([
      'code' => 'required|string|max:40|regex:/^[A-Z0-9_-]+$/|unique:promotions,code',
      'name' => 'required|string|max:100',
      'percent' => 'required|integer|min:1|max:100',
      'expires_on' => 'nullable|date_format:Y-m-d|after_or_equal:today',
      'product_ids' => 'sometimes|array',
      'product_ids.*' => 'integer|distinct|exists:products,id',
      'categories' => 'sometimes|array',
      'categories.*' => 'required|string|distinct|max:60',
      'image' => 'nullable|image|mimes:jpg,jpeg,png,webp|max:2048',
    ]);
    unset($d['image']);
    if (array_key_exists('product_ids', $d)) {
      $d['product_ids'] = json_encode(array_map('intval', $d['product_ids']));
    }
    if (array_key_exists('categories', $d)) {
      $d['categories'] = json_encode(array_values($d['categories']));
    }
    $path = $r->hasFile('image') ? $r->file('image')->store('promotions', 'local') : null;
    if ($path) {
      $d['image_path'] = $path;
    }
    try {
      $id = DB::table('promotions')->insertGetId([
        ...$d,
        'active' => true,
        'created_at' => now(),
        'updated_at' => now(),
      ]);
    } catch (\Throwable $e) {
      if ($path) {
        \Illuminate\Support\Facades\Storage::disk('local')->delete($path);
      }
      throw $e;
    }
    return response()->json($this->present(DB::table('promotions')->find($id)), 201);
  }
  public function image(Request $r, int $id)
  {
    $p = DB::table('promotions')->whereNull('deleted_at')->find($id);
    abort_unless($p && $p->image_path, 404);
    if ($r->user()->role !== 'admin') {
      abort_unless($p->active && (!$p->expires_on || $p->expires_on >= now()->toDateString()), 404);
    }
    $disk = \Illuminate\Support\Facades\Storage::disk('local');
    abort_unless($disk->exists($p->image_path), 404);
    return response()->file($disk->path($p->image_path), [
      'Cache-Control' => 'private, no-cache',
      'X-Content-Type-Options' => 'nosniff',
    ]);
  }
  public function uploadImage(Request $r, int $id)
  {
    $p = DB::table('promotions')->whereNull('deleted_at')->find($id);
    abort_unless($p, 404);
    $r->validate(['image' => 'required|image|mimes:jpg,jpeg,png,webp|max:2048']);
    $path = $r->file('image')->store('promotions', 'local');
    try {
      DB::table('promotions')
        ->where('id', $id)
        ->update(['image_path' => $path, 'updated_at' => now()]);
    } catch (\Throwable $e) {
      \Illuminate\Support\Facades\Storage::disk('local')->delete($path);
      throw $e;
    }
    if ($p->image_path) {
      \Illuminate\Support\Facades\Storage::disk('local')->delete($p->image_path);
    }
    return response()->json($this->present(DB::table('promotions')->find($id)));
  }
  public function update(Request $r, int $id)
  {
    $this->normalizeScope($r);
    $p = DB::table('promotions')->whereNull('deleted_at')->find($id);
    abort_unless($p, 404);
    $r->merge(['code' => strtoupper(trim((string) $r->input('code')))]);
    $d = $r->validate([
      'name' => 'required|string|max:100',
      'code' => [
        'required',
        'string',
        'max:40',
        'regex:/^[A-Z0-9_-]+$/',
        \Illuminate\Validation\Rule::unique('promotions', 'code')->ignore($id),
      ],
      'percent' => 'required|integer|min:1|max:100',
      'expires_on' => 'nullable|date_format:Y-m-d|after_or_equal:today',
      'product_ids' => 'sometimes|array',
      'product_ids.*' => 'integer|distinct|exists:products,id',
      'categories' => 'sometimes|array',
      'categories.*' => 'required|string|distinct|max:60',
      'image' => 'nullable|image|mimes:jpg,jpeg,png,webp|max:2048',
    ]);
    unset($d['image']);
    if (array_key_exists('product_ids', $d)) {
      $d['product_ids'] = json_encode(array_map('intval', $d['product_ids']));
    }
    if (array_key_exists('categories', $d)) {
      $d['categories'] = json_encode(array_values($d['categories']));
    }
    $path = $r->hasFile('image') ? $r->file('image')->store('promotions', 'local') : null;
    if ($path) {
      $d['image_path'] = $path;
    }
    try {
      DB::table('promotions')
        ->where('id', $id)
        ->update([...$d, 'updated_at' => now()]);
    } catch (\Throwable $e) {
      if ($path) {
        \Illuminate\Support\Facades\Storage::disk('local')->delete($path);
      }
      throw $e;
    }
    if ($path && $p->image_path) {
      \Illuminate\Support\Facades\Storage::disk('local')->delete($p->image_path);
    }
    return response()->json($this->present(DB::table('promotions')->find($id)));
  }
  public function destroy(int $id)
  {
    abort_unless(DB::table('promotions')->whereNull('deleted_at')->where('id', $id)->exists(), 404);
    DB::table('promotions')
      ->where('id', $id)
      ->update(['active' => false, 'deleted_at' => now(), 'updated_at' => now()]);
    return response()->json([
      'message' => 'Promotion deleted. Historical discounts are preserved.',
    ]);
  }
  public function toggle(Request $r, int $id)
  {
    $r->validate(['active' => 'required|boolean']);
    $p = DB::table('promotions')->whereNull('deleted_at')->find($id);
    if ($r->boolean('active') && $p && $p->expires_on && $p->expires_on < now()->toDateString()) {
      throw ValidationException::withMessages([
        'active' => 'Edit the expired date before confirming this promotion.',
      ]);
    }
    abort_unless(DB::table('promotions')->whereNull('deleted_at')->where('id', $id)->exists(), 404);
    DB::table('promotions')
      ->where('id', $id)
      ->update(['active' => $r->boolean('active'), 'updated_at' => now()]);
    return response()->json($this->present(DB::table('promotions')->find($id)));
  }
  public static function discount(int $subtotal, ?string $code, array $lines = []): array
  {
    if (!$code) {
      return ['subtotal_cents' => $subtotal, 'discount_cents' => 0, 'promotion_code' => null];
    }
    $code = strtoupper(trim($code));
    $p = DB::table('promotions')
      ->where('code', $code)
      ->whereNull('deleted_at')
      ->where('active', true)
      ->first();
    if (!$p || ($p->expires_on && $p->expires_on < now()->toDateString())) {
      throw ValidationException::withMessages([
        'promotion_code' => 'This promotion is invalid, inactive or expired.',
      ]);
    }
    $ids = $p->product_ids ? json_decode($p->product_ids, true) : [];
    $categories = $p->categories ? json_decode($p->categories, true) : [];
    $eligibleIds = array_map('intval', $ids);
    $hasScope = (bool) ($ids || $categories);
    if ($categories) {
      $lineIds = array_values(array_unique(array_map(fn($line) => (int) $line['product_id'], $lines)));
      $categoryById = DB::table('products')
        ->whereIn('id', $lineIds)
        ->pluck('category', 'id')
        ->map(fn($c) => trim((string) $c))
        ->all();
      foreach ($categoryById as $productId => $category) {
        if (in_array($category, $categories, true)) {
          $eligibleIds[] = (int) $productId;
        }
      }
      $eligibleIds = array_values(array_unique($eligibleIds));
    }
    $eligible = $subtotal;
    if ($hasScope) {
      $eligibleLines = array_filter(
        $lines,
        fn($line) => in_array((int) $line['product_id'], $eligibleIds, true),
      );
      if (!$eligibleLines) {
        throw ValidationException::withMessages([
          'promotion_code' => 'Add an eligible product to use this promotion.',
        ]);
      }
      $eligible = array_sum(
        array_map(fn($line) => $line['price_cents'] * $line['quantity'], $eligibleLines),
      );
    }
    return [
      'subtotal_cents' => $subtotal,
      'discount_cents' => min($subtotal, (int) round(($eligible * $p->percent) / 100)),
      'promotion_code' => $code,
    ];
  }
}
