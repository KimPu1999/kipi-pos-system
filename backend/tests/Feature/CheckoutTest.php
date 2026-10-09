<?php
namespace Tests\Feature;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;
use App\Models\User;
class CheckoutTest extends TestCase
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
  public function test_percentage_discount_is_calculated_by_server(): void
  {
    $id = $this->product();
    $body = [
      'payment_method' => 'cash',
      'discount_percent' => 10,
      'items' => [['product_id' => $id, 'quantity' => 2]],
    ];
    $this->postJson('/api/sales', $body)
      ->assertCreated()
      ->assertJsonPath('discount_cents', 90)
      ->assertJsonPath('total_cents', 810);
    $this->postJson('/api/sales', [...$body, 'discount_percent' => 101])->assertUnprocessable();
    $this->postJson('/api/sales', [...$body, 'discount_percent' => -1])->assertUnprocessable();
  }
  public function test_pos_sale_records_the_selected_product_size(): void
  {
    $id = $this->product();
    DB::table('products')
      ->where('id', $id)
      ->update([
        'small_price_cents' => 300,
        'medium_price_cents' => 450,
        'large_price_cents' => 700,
      ]);
    $this->postJson('/api/sales', [
      'payment_method' => 'cash',
      'items' => [['product_id' => $id, 'quantity' => 1, 'size' => 'small']],
    ])
      ->assertCreated()
      ->assertJsonPath('items.0.size', 'small')
      ->assertJsonPath('items.0.price_cents', 300)
      ->assertJsonPath('total_cents', 300);
    $this->assertDatabaseHas('sale_items', [
      'product_id' => $id,
      'size' => 'small',
      'price_cents' => 300,
    ]);
    $this->postJson('/api/sales', [
      'payment_method' => 'cash',
      'items' => [['product_id' => $id, 'quantity' => 1, 'size' => 'extra_large']],
    ])->assertUnprocessable();
    DB::table('products')
      ->where('id', $id)
      ->update(['medium_price_cents' => null, 'large_price_cents' => null]);
    $this->postJson('/api/sales', [
      'payment_method' => 'cash',
      'items' => [['product_id' => $id, 'quantity' => 1, 'size' => 'medium']],
    ])->assertUnprocessable();
  }
  public function test_configured_tax_is_applied_after_discount(): void
  {
    DB::table('system_settings')->insert([
      'id' => 1,
      'settings' => json_encode(['tax_percent' => 10]),
      'created_at' => now(),
      'updated_at' => now(),
    ]);
    $id = $this->product();
    $this->postJson('/api/sales', [
      'payment_method' => 'cash',
      'discount_percent' => 10,
      'amount_received_cents' => 1000,
      'items' => [['product_id' => $id, 'quantity' => 2]],
    ])
      ->assertCreated()
      ->assertJsonPath('subtotal_cents', 900)
      ->assertJsonPath('discount_cents', 90)
      ->assertJsonPath('tax_percent', 10)
      ->assertJsonPath('tax_cents', 81)
      ->assertJsonPath('total_cents', 891)
      ->assertJsonPath('change_cents', 109);
  }
  public function test_custom_discount_reprices_payment_and_invalid_discount_rolls_back(): void
  {
    $id = $this->product();
    $body = [
      'payment_method' => 'cash',
      'items' => [['product_id' => $id, 'quantity' => 2]],
      'discount_cents' => 200,
      'amount_received_cents' => 800,
    ];
    $this->postJson('/api/sales', $body)
      ->assertCreated()
      ->assertJsonPath('subtotal_cents', 900)
      ->assertJsonPath('discount_cents', 200)
      ->assertJsonPath('total_cents', 700)
      ->assertJsonPath('change_cents', 100);
    $this->postJson('/api/sales', [...$body, 'discount_cents' => 901])->assertUnprocessable();
    $this->assertDatabaseHas('products', ['id' => $id, 'stock' => 3]);
    $this->assertDatabaseCount('sales', 1);
    $this->postJson('/api/sales', [...$body, 'discount_cents' => -1])->assertUnprocessable();
  }
  public function test_checkout_uses_database_price_and_reduces_stock(): void
  {
    $id = $this->product();
    $this->postJson('/api/sales', [
      'payment_method' => 'cash',
      'items' => [['product_id' => $id, 'quantity' => 2, 'price_cents' => 1]],
      'total_cents' => 2,
    ])
      ->assertCreated()
      ->assertJsonPath('total_cents', 900)
      ->assertJsonPath('items.0.quantity', 2);
    $this->assertDatabaseHas('products', ['id' => $id, 'stock' => 3]);
    $this->assertDatabaseCount('sales', 1);
  }
  public function test_insufficient_stock_rolls_back_the_whole_sale(): void
  {
    $first = $this->product();
    $second = $this->product(0);
    $this->postJson('/api/sales', [
      'payment_method' => 'card',
      'items' => [
        ['product_id' => $first, 'quantity' => 2],
        ['product_id' => $second, 'quantity' => 1],
      ],
    ])->assertUnprocessable();
    $this->assertDatabaseHas('products', ['id' => $first, 'stock' => 5]);
    $this->assertDatabaseCount('sales', 0);
  }
  public function test_duplicate_products_and_invalid_payment_are_rejected(): void
  {
    $id = $this->product();
    $this->postJson('/api/sales', [
      'payment_method' => 'cash',
      'items' => [['product_id' => $id, 'quantity' => 1], ['product_id' => $id, 'quantity' => 1]],
    ])->assertUnprocessable();
    $this->postJson('/api/sales', [
      'payment_method' => 'invalid',
      'items' => [['product_id' => $id, 'quantity' => 1]],
    ])->assertUnprocessable();
    $this->assertDatabaseHas('products', ['id' => $id, 'stock' => 5]);
  }
  public function test_product_sku_is_unique(): void
  {
    $id = $this->product();
    $p = DB::table('products')->find($id);
    $this->postJson('/api/products', [
      'name' => 'Other',
      'sku' => $p->sku,
      'category' => 'Coffee',
      'price_cents' => 200,
      'stock' => 1,
    ])->assertUnprocessable();
  }
  public function test_cash_payment_saves_received_amount_and_change(): void
  {
    $id = $this->product();
    $this->postJson('/api/sales', [
      'payment_method' => 'cash',
      'amount_received_cents' => 1000,
      'items' => [['product_id' => $id, 'quantity' => 2]],
    ])
      ->assertCreated()
      ->assertJsonPath('total_cents', 900)
      ->assertJsonPath('amount_received_cents', 1000)
      ->assertJsonPath('change_cents', 100);
    $this->getJson('/api/sales')->assertOk()->assertJsonPath('0.change_cents', 100);
  }
  public function test_insufficient_cash_rolls_back_stock_and_sale(): void
  {
    $id = $this->product();
    $this->postJson('/api/sales', [
      'payment_method' => 'cash',
      'amount_received_cents' => 100,
      'items' => [['product_id' => $id, 'quantity' => 2]],
    ])
      ->assertUnprocessable()
      ->assertJsonValidationErrors('amount_received_cents');
    $this->assertDatabaseHas('products', ['id' => $id, 'stock' => 5]);
    $this->assertDatabaseCount('sales', 0);
  }
  public function test_card_payment_has_no_cash_change(): void
  {
    $id = $this->product();
    $this->postJson('/api/sales', [
      'payment_method' => 'card',
      'amount_received_cents' => 1000,
      'items' => [['product_id' => $id, 'quantity' => 1]],
    ])
      ->assertCreated()
      ->assertJsonPath('amount_received_cents', null)
      ->assertJsonPath('change_cents', 0);
  }
}
