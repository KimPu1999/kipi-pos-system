<?php
namespace Tests\Feature;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;
class ReportTest extends TestCase
{
  use RefreshDatabase;
  public function test_reports_use_local_period_boundaries_and_discounted_revenue(): void
  {
    $u = User::create([
      'name' => 'Admin',
      'email' => 'admin@example.com',
      'password' => 'password-123',
    ]);
    $u->role = 'admin';
    $u->save();
    $this->actingAs($u);
    $p = DB::table('products')->insertGetId([
      'name' => 'Coffee',
      'sku' => 'COF',
      'category' => 'Coffee',
      'price_cents' => 450,
      'stock' => 7,
    ]);
    $s = DB::table('sales')->insertGetId([
      'total_cents' => 810,
      'discount_cents' => 90,
      'payment_method' => 'cash',
      'created_at' => '2026-10-05 18:00:00',
      'updated_at' => '2026-10-05 18:00:00',
    ]);
    DB::table('sale_items')->insert([
      'sale_id' => $s,
      'product_id' => $p,
      'name' => 'Coffee',
      'price_cents' => 450,
      'quantity' => 2,
    ]);
    $this->getJson('/api/admin/reports?period=day&date=2026-10-06')
      ->assertOk()
      ->assertJsonPath('summary.net_cents', 810)
      ->assertJsonPath('summary.gross_cents', 900)
      ->assertJsonPath('summary.discount_cents', 90)
      ->assertJsonPath('summary.quantity', 2)
      ->assertJsonPath('buckets.0.net_cents', 810)
      ->assertJsonPath('inventory_summary.available_units', 7)
      ->assertJsonPath('inventory_summary.value_cents', 3150);
    $this->getJson('/api/admin/reports?period=day&date=2026-10-05')
      ->assertOk()
      ->assertJsonPath('summary.sales_count', 0);
    $this->getJson('/api/admin/reports?period=month&date=2026-10-01')
      ->assertOk()
      ->assertJsonCount(31, 'buckets')
      ->assertJsonPath('summary.net_cents', 810);
    $this->getJson('/api/admin/reports?period=year&date=2026-01-01')
      ->assertOk()
      ->assertJsonCount(12, 'buckets')
      ->assertJsonPath('summary.quantity', 2);
  }
  public function test_report_validation_and_admin_permissions(): void
  {
    $u = User::create([
      'name' => 'Customer',
      'email' => 'customer@example.com',
      'password' => 'password-123',
    ]);
    $this->actingAs($u);
    $this->getJson('/api/admin/reports?period=day&date=2026-10-06')->assertForbidden();
    $u->role = 'admin';
    $u->save();
    $this->getJson('/api/admin/reports?period=invalid&date=not-a-date')->assertUnprocessable();
  }
}
