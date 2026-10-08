<?php
namespace App\Http\Controllers;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
class SettingsController
{
  private function data(): array
  {
    return array_merge(
      [
        'store_name' => 'Kipi POS',
        'accent' => '#d96700',
        'light_background' => '#f5f2ee',
        'light_text' => '#29231e',
        'dark_background' => '#131519',
        'dark_text' => '#f2f4f8',
        'font_size' => 16,
        'font_weight' => 600,
        'default_theme' => 'light',
        'tax_percent' => 0,
      ],
      json_decode(DB::table('system_settings')->where('id', 1)->value('settings') ?? '{}', true),
    );
  }
  public function index()
  {
    return response()->json($this->data());
  }
  public function update(Request $r)
  {
    $rules = [
      'store_name' => 'required|string|max:80',
      'font_size' => 'required|integer|min:14|max:20',
      'font_weight' => 'required|integer|in:400,500,600,700',
      'default_theme' => 'required|in:light,dark',
      'tax_percent' => 'required|numeric|min:0|max:100',
    ];
    foreach (['accent', 'light_background', 'light_text', 'dark_background', 'dark_text'] as $key) {
      $rules[$key] = 'required|regex:/^#[0-9a-fA-F]{6}$/';
    }
    $d = $r->validate($rules);
    DB::table('system_settings')->updateOrInsert(
      ['id' => 1],
      ['settings' => json_encode($d), 'created_at' => now(), 'updated_at' => now()],
    );
    return response()->json($d);
  }
  public function info()
  {
    return response()->json([
      'app_version' => '1.0.0',
      'laravel_version' => app()->version(),
      'php_version' => PHP_VERSION,
      'currency' => 'MMK',
      'timezone' => 'Asia/Yangon',
      'database' => config('database.default'),
    ]);
  }
}
