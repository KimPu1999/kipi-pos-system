<?php
namespace Tests\Feature;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;
class ProductDeleteTest extends TestCase
{
  use RefreshDatabase;
  public function test_only_admin_can_delete_unreferenced_products(): void
  {
    $admin = User::create([
      'name' => 'Admin',
      'email' => 'delete-admin@example.com',
      'password' => 'password-123',
    ]);
    $admin->role = 'admin';
    $admin->save();
    $this->actingAs($admin);
    $id = $this->postJson('/api/products', [
      'name' => 'Tea',
      'sku' => 'DELETE1',
      'category' => 'Drinks',
      'price_cents' => 50000,
      'stock' => 10,
    ])
      ->assertCreated()
      ->json('id');
    $customer = User::create([
      'name' => 'Buyer',
      'email' => 'delete-buyer@example.com',
      'password' => 'password-123',
    ]);
    $this->actingAs($customer)
      ->deleteJson('/api/products/' . $id . '/permanent')
      ->assertForbidden();
    $this->actingAs($admin)
      ->deleteJson('/api/products/' . $id . '/permanent')
      ->assertOk();
    $this->assertDatabaseMissing('products', ['id' => $id]);
  }
  public function test_product_edit_keeps_sku_and_rejects_stale_stock(): void
  {
    $admin = User::create([
      'name' => 'Admin',
      'email' => 'edit-admin@example.com',
      'password' => 'password-123',
    ]);
    $admin->role = 'admin';
    $admin->save();
    $this->actingAs($admin);
    $id = $this->postJson('/api/products', [
      'name' => 'Tea',
      'sku' => 'FIXED1',
      'category' => 'Drinks',
      'price_cents' => 50000,
      'stock' => 10,
    ])
      ->assertCreated()
      ->json('id');
    $data = [
      'name' => 'Green tea',
      'sku' => 'FIXED1',
      'category' => 'Hot drinks',
      'price_cents' => 60000,
      'stock' => 12,
      'expected_stock' => 10,
      'emoji' => '☕',
      'active' => true,
    ];
    $this->putJson('/api/products/' . $id, $data)
      ->assertOk()
      ->assertJsonPath('name', 'Green tea')
      ->assertJsonPath('sku', 'FIXED1');
    $this->putJson('/api/products/' . $id, [...$data, 'sku' => 'CHANGED'])->assertUnprocessable();
    $this->putJson('/api/products/' . $id, $data)->assertConflict();
    $this->assertDatabaseHas('products', ['id' => $id, 'stock' => 12, 'sku' => 'FIXED1']);
  }
  public function test_transaction_history_prevents_deletion(): void
  {
    $admin = User::create([
      'name' => 'Admin',
      'email' => 'history-admin@example.com',
      'password' => 'password-123',
    ]);
    $admin->role = 'admin';
    $admin->save();
    $this->actingAs($admin);
    $id = $this->postJson('/api/products', [
      'name' => 'Tea',
      'sku' => 'DELETE2',
      'category' => 'Drinks',
      'price_cents' => 50000,
      'stock' => 10,
    ])
      ->assertCreated()
      ->json('id');
    $sale = DB::table('sales')->insertGetId([
      'total_cents' => 50000,
      'payment_method' => 'cash',
      'created_at' => now(),
      'updated_at' => now(),
    ]);
    DB::table('sale_items')->insert([
      'sale_id' => $sale,
      'product_id' => $id,
      'name' => 'Tea',
      'price_cents' => 50000,
      'quantity' => 1,
    ]);
    $this->deleteJson('/api/products/' . $id . '/permanent')->assertConflict();
    $this->assertDatabaseHas('products', ['id' => $id]);
    $this->assertDatabaseHas('sale_items', ['product_id' => $id]);
  }
}
