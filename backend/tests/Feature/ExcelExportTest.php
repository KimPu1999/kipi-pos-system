<?php
namespace Tests\Feature;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;
class ExcelExportTest extends TestCase
{
  use RefreshDatabase;
  public function test_export_is_admin_only_and_contains_monthly_receipts_without_deleting_data(): void
  {
    $user = User::create([
      'name' => 'Export user',
      'email' => 'export@example.com',
      'password' => 'password-123',
    ]);
    $this->actingAs($user)->get('/api/admin/export?range=all')->assertForbidden();
    $user->role = 'admin';
    $user->save();
    DB::table('sales')->insert([
      [
        'id' => 1,
        'total_cents' => 1200000,
        'payment_method' => 'cash',
        'created_at' => '2026-09-30 17:30:00',
        'updated_at' => '2026-09-30 17:30:00',
      ],
      [
        'id' => 2,
        'total_cents' => 100,
        'payment_method' => 'cash',
        'created_at' => '2026-09-30 17:29:59',
        'updated_at' => '2026-09-30 17:29:59',
      ],
    ]);
    $response = $this->get('/api/admin/export?range=month&month=2026-10')->assertOk();
    $path = $response->baseResponse->getFile()->getPathname();
    $zip = new \ZipArchive();
    $this->assertTrue($zip->open($path));
    $this->assertStringContainsString('Bills and receipts', $zip->getFromName('xl/workbook.xml'));
    $xml = $zip->getFromName('xl/worksheets/sheet4.xml');
    $this->assertStringContainsString('12000', $xml);
    $this->assertStringContainsString('2026-10-01 00:00:00', $xml);
    $this->assertStringNotContainsString('2026-09-30 23:59:59', $xml);
    for ($i = 1; $i <= 8; $i++) {
      $this->assertNotFalse(
        simplexml_load_string($zip->getFromName('xl/worksheets/sheet' . $i . '.xml')),
      );
    }
    $zip->close();
    unlink($path);
    $this->assertDatabaseCount('sales', 2);
    $this->getJson('/api/admin/export?range=month&month=wrong')->assertUnprocessable();
  }
}
