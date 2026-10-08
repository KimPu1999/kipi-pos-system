<?php
namespace Tests\Feature;
use App\Services\GoogleSheetsSync;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;
class GoogleSheetsSyncTest extends TestCase
{
  use RefreshDatabase;
  public function test_sync_updates_ids_preserves_archives_and_uses_raw_values(): void
  {
    config([
      'google_sheets.enabled' => true,
      'google_sheets.spreadsheet_id' => 'test-sheet',
      'cache.default' => 'array',
    ]);
    $key = openssl_pkey_new([
      'private_key_bits' => 2048,
      'private_key_type' => OPENSSL_KEYTYPE_RSA,
    ]);
    openssl_pkey_export($key, $pem);
    $path = tempnam(sys_get_temp_dir(), 'sheets-test-');
    file_put_contents(
      $path,
      json_encode([
        'type' => 'service_account',
        'client_email' => 'test@example.com',
        'private_key' => $pem,
      ]),
    );
    config(['google_sheets.credentials' => $path]);
    $titles = [
      'Kipi Orders',
      'Kipi Receipts',
      'Kipi Order Items',
      'Kipi Receipt Items',
      'Kipi Inventory',
    ];
    $sheets = [];
    foreach ($titles as $i => $title) {
      $sheets[] = [
        'properties' => [
          'sheetId' => $i,
          'title' => $title,
          'gridProperties' => ['rowCount' => 1000],
        ],
      ];
    }
    Http::preventStrayRequests();
    Http::fake(function ($request) use ($sheets) {
      if (str_contains($request->url(), 'oauth2')) {
        return Http::response(['access_token' => 'fake-token']);
      }
      if (str_contains($request->url(), '/values/') && $request->method() === 'GET') {
        return Http::response(['values' => [['Id'], ['999', 'Archived row']]]);
      }
      if (str_contains($request->url(), ':batchUpdate')) {
        return Http::response([]);
      }
      return Http::response(['sheets' => $sheets]);
    });
    DB::table('products')->insert([
      'id' => 1,
      'name' => '=formula-looking product',
      'sku' => 'SYNC1',
      'category' => 'Tea',
      'stock' => 10,
      'active' => 1,
      'price_cents' => 500000,
      'emoji' => '',
      'created_at' => now(),
      'updated_at' => now(),
    ]);
    try {
      $this->assertSame(1, app(GoogleSheetsSync::class)->run());
      $this->assertSame(1, app(GoogleSheetsSync::class)->run());
      Http::assertSent(function ($request) {
        if (!str_contains($request->url(), '/values:batchUpdate')) {
          return false;
        }
        $data = $request->data();
        $rows = $data['data'][4]['values'];
        return $data['valueInputOption'] === 'RAW' &&
          count($rows) === 3 &&
          $rows[1][0] === '999' &&
          $rows[2][0] === 1 &&
          $rows[2][6] === 5000;
      });
      $this->assertDatabaseCount('products', 1);
    } finally {
      unlink($path);
    }
  }
}
