<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class StoreIsolationMatrixTest extends TestCase
{
  use RefreshDatabase;

  private function admin(int $storeId, string $email): User
  {
    $user = User::create([
      'name' => 'Store admin ' . $storeId,
      'email' => $email,
      'password' => 'password-123',
    ]);
    $user->role = 'admin';
    $user->save();
    DB::table('store_memberships')->insert([
      'store_id' => $storeId,
      'user_id' => $user->id,
      'role' => 'admin',
      'status' => 'active',
      'created_at' => now(),
      'updated_at' => now(),
    ]);
    return $user;
  }

  private function customer(string $email): User
  {
    $user = User::create([
      'name' => 'Customer',
      'email' => $email,
      'password' => 'password-123',
    ]);
    $user->role = 'customer';
    $user->save();
    return $user;
  }

  private function productPayload(string $sku): array
  {
    return [
      'name' => 'Scoped product',
      'sku' => $sku,
      'category' => 'Test',
      'price_cents' => 1000,
      'stock' => 10,
      'emoji' => 'P',
      'active' => true,
    ];
  }

  public function test_store_admin_with_multiple_active_memberships_fails_closed(): void
  {
    $admin = $this->admin(1, 'multi@example.test');
    DB::table('store_memberships')->insert([
      'store_id' => 2,
      'user_id' => $admin->id,
      'role' => 'admin',
      'status' => 'active',
      'created_at' => now(),
      'updated_at' => now(),
    ]);

    $this->actingAs($admin)
      ->withHeader('X-Store-ID', '1')
      ->getJson('/api/products')
      ->assertStatus(409);
    $this->actingAs($admin)
      ->withHeader('X-Store-ID', '2')
      ->getJson('/api/products')
      ->assertStatus(409);
  }

  public function test_store_admin_of_inactive_store_is_denied(): void
  {
    $admin = $this->admin(2, 'inactive-store@example.test');
    DB::table('stores')
      ->where('id', 2)
      ->update(['status' => 'inactive', 'updated_at' => now()]);

    $this->actingAs($admin)->getJson('/api/products')->assertForbidden();
    $this->actingAs($admin)->getJson('/api/sales')->assertForbidden();
    $this->actingAs($admin)->getJson('/api/settings')->assertForbidden();
  }

  public function test_store_admin_cannot_switch_store_with_client_input(): void
  {
    $adminA = $this->admin(1, 'spoof-a@example.test');
    $this->admin(2, 'spoof-b@example.test');

    $this->actingAs($adminA)
      ->withHeader('X-Store-ID', '2')
      ->getJson('/api/products')
      ->assertForbidden();
    $this->actingAs($adminA)
      ->withHeader('X-Store-ID', '2')
      ->getJson('/api/sales')
      ->assertForbidden();
    $this->actingAs($adminA)
      ->withHeader('X-Store-ID', '2')
      ->getJson('/api/employees')
      ->assertForbidden();
    $this->actingAs($adminA)
      ->withHeader('X-Store-ID', '2')
      ->getJson('/api/cash-entries')
      ->assertForbidden();
    $this->actingAs($adminA)
      ->withHeader('X-Store-ID', '2')
      ->getJson('/api/admin/reports?period=day&date=2026-10-06')
      ->assertForbidden();
  }

  public function test_products_and_employees_stay_inside_the_admin_store(): void
  {
    $adminA = $this->admin(1, 'store-a@example.test');
    $adminB = $this->admin(2, 'store-b@example.test');

    $productB = $this->actingAs($adminB)
      ->postJson('/api/products', $this->productPayload('STORE-B-SKU'))
      ->assertCreated()
      ->json('id');
    $this->actingAs($adminB)
      ->postJson('/api/employees', [
        'employee_code' => 'EMP-B',
        'name' => 'Bravo',
        'salary_cents' => 1000,
        'active' => true,
      ])
      ->assertCreated();

    $this->actingAs($adminA)
      ->getJson('/api/products')
      ->assertOk()
      ->assertJsonMissing(['sku' => 'STORE-B-SKU']);
    $this->actingAs($adminA)
      ->patchJson('/api/products/' . $productB . '/active', ['active' => false])
      ->assertNotFound();
    $this->actingAs($adminA)
      ->getJson('/api/employees')
      ->assertOk()
      ->assertJsonCount(0, 'employees');
  }

  public function test_purchases_and_cash_entries_stay_inside_the_admin_store(): void
  {
    $adminA = $this->admin(1, 'purchase-a@example.test');
    $adminB = $this->admin(2, 'purchase-b@example.test');

    $productB = $this->actingAs($adminB)
      ->postJson('/api/products', $this->productPayload('PUR-B-SKU'))
      ->assertCreated()
      ->json('id');
    $purchaseB = $this->actingAs($adminB)
      ->postJson('/api/purchases', [
        'supplier' => 'Store B supplier',
        'purchased_on' => '2026-10-06',
        'request_id' => 'bb81d22f-bc08-4c68-b952-d7c8c3ded891',
        'items' => [['product_id' => $productB, 'quantity' => 1, 'unit_cost_cents' => 100]],
      ])
      ->assertCreated()
      ->json('id');
    $cashB = $this->actingAs($adminB)
      ->postJson('/api/cash-entries', [
        'type' => 'in',
        'payment_status' => 'paid',
        'amount_cents' => 5000,
        'category' => 'Opening',
        'entry_date' => '2026-10-06',
      ])
      ->assertCreated()
      ->json('id');

    $this->actingAs($adminA)->getJson('/api/purchases')->assertOk()->assertJsonCount(0);
    $this->actingAs($adminA)
      ->putJson('/api/purchases/' . $purchaseB, [
        'supplier' => 'Hijack',
        'purchased_on' => '2026-10-07',
        'items' => [['id' => 1, 'unit_cost_cents' => 1]],
      ])
      ->assertNotFound();

    $this->actingAs($adminA)
      ->getJson('/api/cash-entries')
      ->assertOk()
      ->assertJsonPath('cash_in_cents', 0)
      ->assertJsonPath('balance_cents', 0)
      ->assertJsonCount(0, 'entries');
    $this->actingAs($adminA)
      ->putJson('/api/cash-entries/' . $cashB, [
        'type' => 'out',
        'payment_status' => 'paid',
        'amount_cents' => 1,
        'category' => 'Hijack',
        'entry_date' => '2026-10-06',
      ])
      ->assertNotFound();
    $this->actingAs($adminA)
      ->deleteJson('/api/cash-entries/' . $cashB)
      ->assertNotFound();
  }

  public function test_promotions_dining_tables_and_settings_are_store_scoped(): void
  {
    $adminA = $this->admin(1, 'scope-a@example.test');
    $adminB = $this->admin(2, 'scope-b@example.test');

    $promoB = $this->actingAs($adminB)
      ->postJson('/api/promotions', ['code' => 'B10', 'name' => 'B promo', 'percent' => 10])
      ->assertCreated()
      ->json('id');
    $tableB = $this->actingAs($adminB)
      ->postJson('/api/dining-tables', [
        'name' => 'B Table',
        'seats' => 2,
        'status' => 'available',
      ])
      ->assertCreated()
      ->json('id');
    $this->actingAs($adminB)
      ->putJson('/api/settings', [
        'store_name' => 'Store B name',
        'accent' => '#d96700',
        'light_background' => '#f5f2ee',
        'light_text' => '#29231e',
        'dark_background' => '#131519',
        'dark_text' => '#f2f4f8',
        'font_family' => 'dm_sans',
        'font_size' => 16,
        'font_weight' => 600,
        'default_theme' => 'light',
        'tax_percent' => 5,
      ])
      ->assertOk();

    $this->actingAs($adminA)->getJson('/api/promotions')->assertOk()->assertJsonCount(0);
    $this->actingAs($adminA)
      ->patchJson('/api/promotions/' . $promoB, ['active' => false])
      ->assertNotFound();
    $this->actingAs($adminA)->getJson('/api/dining-tables')->assertOk()->assertJsonCount(0);
    $this->actingAs($adminA)
      ->putJson('/api/dining-tables/' . $tableB, [
        'name' => 'Hijack',
        'seats' => 9,
        'status' => 'available',
      ])
      ->assertNotFound();
    $this->actingAs($adminA)
      ->getJson('/api/settings')
      ->assertOk()
      ->assertJsonPath('store_name', 'Kipi POS')
      ->assertJsonPath('tax_percent', 0);
  }

  public function test_orders_sales_and_reports_are_store_scoped(): void
  {
    $adminA = $this->admin(1, 'orders-a@example.test');
    $adminB = $this->admin(2, 'orders-b@example.test');
    $customer = $this->customer('orders-customer@example.test');

    $productB = $this->actingAs($adminB)
      ->postJson('/api/products', $this->productPayload('ORD-B-SKU'))
      ->assertCreated()
      ->json('id');

    $this->actingAs($customer)
      ->withHeader('X-Store-ID', '2')
      ->postJson('/api/orders', ['items' => [['product_id' => $productB, 'quantity' => 1]]])
      ->assertCreated();
    $this->flushHeaders();

    $this->actingAs($adminA)->getJson('/api/orders')->assertOk()->assertJsonCount(0);

    $this->actingAs($adminB)
      ->postJson('/api/sales', [
        'payment_method' => 'cash',
        'items' => [['product_id' => $productB, 'quantity' => 1]],
      ])
      ->assertCreated();

    $this->actingAs($adminA)->getJson('/api/sales')->assertOk()->assertJsonCount(0);
    $this->actingAs($adminA)
      ->getJson('/api/admin/reports?period=day&date=2026-10-06')
      ->assertOk()
      ->assertJsonPath('summary.sales_count', 0)
      ->assertJsonPath('summary.net_cents', 0);
    $this->assertSame(
      1,
      (int) DB::table('sale_items')->where('store_id', 2)->count(),
      'Child sale items must carry the owning store.',
    );
    $this->assertSame(
      0,
      (int) DB::table('sale_items')->whereNull('store_id')->count(),
      'Store-created child rows must not be left unassigned.',
    );
  }

  public function test_notes_and_announcements_are_store_scoped(): void
  {
    $adminA = $this->admin(1, 'notices-a@example.test');
    $adminB = $this->admin(2, 'notices-b@example.test');

    $this->actingAs($adminB)
      ->postJson('/api/notes', [
        'title' => 'Store B note',
        'category' => 'General',
        'content' => 'Store B only',
        'pinned' => false,
      ])
      ->assertCreated();
    $this->actingAs($adminB)
      ->postJson('/api/announcements', ['title' => 'Store B news', 'message' => 'Store B only'])
      ->assertCreated();

    $this->actingAs($adminA)->getJson('/api/notes')->assertOk()->assertJsonCount(0);
    $this->actingAs($adminA)->getJson('/api/announcements')->assertOk()->assertJsonCount(0);
  }

  public function test_store_admins_cannot_reach_platform_endpoints(): void
  {
    $adminA = $this->admin(1, 'not-platform@example.test');

    $this->actingAs($adminA)->getJson('/api/platform/stores')->assertForbidden();
    $this->actingAs($adminA)
      ->postJson('/api/platform/admins', [
        'name' => 'Sneaky',
        'email' => 'sneaky@example.test',
        'password' => 'password-123',
        'password_confirmation' => 'password-123',
        'store_id' => 2,
      ])
      ->assertForbidden();
    $this->actingAs($adminA)
      ->patchJson('/api/platform/admins/1', ['status' => 'inactive'])
      ->assertForbidden();
    $this->assertDatabaseMissing('users', ['email' => 'sneaky@example.test']);
  }

  public function test_platform_permission_must_be_explicit_and_complete(): void
  {
    $operator = User::create([
      'name' => 'Operator',
      'email' => 'operator@example.test',
      'password' => 'password-123',
    ]);
    $permission = DB::table('permissions')->where('key', 'platform.stores.manage')->value('id');
    DB::table('user_permissions')->insert([
      'user_id' => $operator->id,
      'permission_id' => $permission,
      'created_at' => now(),
      'updated_at' => now(),
    ]);

    // One of the two required permissions is not enough to manage stores/admins.
    $this->actingAs($operator)->getJson('/api/platform/stores')->assertForbidden();
    $this->actingAs($operator)->getJson('/api/platform/admins')->assertForbidden();
  }

  public function test_read_only_platform_permission_cannot_write_store_data(): void
  {
    $operator = User::create([
      'name' => 'Read only',
      'email' => 'readonly@example.test',
      'password' => 'password-123',
    ]);
    DB::table('user_permissions')->insert([
      'user_id' => $operator->id,
      'permission_id' => DB::table('permissions')
        ->where('key', 'platform.data.read_all')
        ->value('id'),
      'created_at' => now(),
      'updated_at' => now(),
    ]);

    $this->actingAs($operator)->withHeader('X-Store-ID', '2')->getJson('/api/products')->assertOk();
    $this->actingAs($operator)
      ->withHeader('X-Store-ID', '2')
      ->postJson('/api/products', $this->productPayload('READONLY-WRITE'))
      ->assertForbidden();
  }

  public function test_admin_customer_creation_rejects_duplicate_global_email(): void
  {
    $adminA = $this->admin(1, 'dupe-a@example.test');
    $this->customer('shared@example.test');

    $this->actingAs($adminA)
      ->postJson('/api/admin/customers', [
        'name' => 'Duplicate',
        'email' => 'shared@example.test',
        'password' => 'password-123',
        'password_confirmation' => 'password-123',
      ])
      ->assertUnprocessable()
      ->assertJsonValidationErrors('email');
  }
}
