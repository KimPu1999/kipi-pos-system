<?php
namespace Tests\Feature;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;
use App\Models\User;
class BillsTest extends TestCase
{
  use RefreshDatabase;
  protected function setUp(): void
  {
    parent::setUp();
    $user = User::create([
      'name' => 'Cashier',
      'email' => 'cashier@example.com',
      'password' => 'secure-password',
    ]);
    $user->role = 'admin';
    $user->save();
    $this->actingAs($user);
  }
  private function product(int $stock = 5): int
  {
    return DB::table('products')->insertGetId([
      'name' => 'Coffee',
      'sku' => uniqid(),
      'category' => 'Coffee',
      'price_cents' => 450,
      'stock' => $stock,
      'emoji' => '☕',
      'created_at' => now(),
      'updated_at' => now(),
    ]);
  }
  private function bill(int $productId, string $utcAt): int
  {
    $this->travelTo(\Carbon\Carbon::parse($utcAt, 'UTC'));
    return $this->postJson('/api/sales', [
      'payment_method' => 'cash',
      'items' => [['product_id' => $productId, 'quantity' => 1]],
    ])
      ->assertCreated()
      ->json('id');
  }
  public function test_bills_are_filtered_by_day_week_month_year_and_all(): void
  {
    $productId = $this->product();
    $monday = $this->bill($productId, '2026-10-05 02:00:00');
    $tuesday = $this->bill($productId, '2026-10-06 02:00:00');
    $this->getJson('/api/sales?range=day&date=2026-10-05')
      ->assertOk()
      ->assertJsonCount(1)
      ->assertJsonPath('0.id', $monday);
    $this->getJson('/api/sales?range=day&date=2026-10-06')
      ->assertOk()
      ->assertJsonCount(1)
      ->assertJsonPath('0.id', $tuesday);
    $this->getJson('/api/sales?range=week&date=2026-10-06')
      ->assertOk()
      ->assertJsonCount(2);
    $this->getJson('/api/sales?range=month&date=2026-10-06')->assertOk()->assertJsonCount(2);
    $this->getJson('/api/sales?range=year&date=2026-10-06')->assertOk()->assertJsonCount(2);
    $this->getJson('/api/sales?range=all')->assertOk()->assertJsonCount(2);
    $this->getJson('/api/sales?range=day')->assertUnprocessable();
    $this->getJson('/api/sales?range=week&date=2026-10-01')
      ->assertOk()
      ->assertJsonCount(0);
  }
  public function test_bills_export_to_excel_and_pdf(): void
  {
    $productId = $this->product();
    $this->bill($productId, '2026-10-05 02:00:00');
    $excel = $this->get('/api/sales/export?range=day&date=2026-10-05')
      ->assertOk()
      ->assertHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
    $this->assertStringContainsString(
      'kipi-bills-2026-10-05.xlsx',
      $excel->headers->get('content-disposition'),
    );
    $pdf = $this->get('/api/sales/export-pdf?range=day&date=2026-10-05')
      ->assertOk()
      ->assertHeader('Content-Type', 'application/pdf');
    $this->assertStringContainsString(
      'kipi-bills-2026-10-05.pdf',
      $pdf->headers->get('content-disposition'),
    );
    $this->get('/api/sales/export?range=day')->assertUnprocessable();
    $this->get('/api/sales/export-pdf?range=week&date=2026-99-99')->assertUnprocessable();
  }
}