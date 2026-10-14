<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class MultiStoreIsolationTest extends TestCase
{
  use RefreshDatabase;

  private function admin(int $storeId, string $email): User
  {
    $user = User::create([
      'name' => 'Store admin',
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

  private function product(string $sku): array
  {
    return [
      'name' => 'Scoped product',
      'sku' => $sku,
      'category' => 'Test',
      'price_cents' => 1000,
      'stock' => 10,
      'emoji' => '📦',
      'active' => true,
    ];
  }

  public function test_store_admins_cannot_read_or_modify_each_others_products(): void
  {
    $adminA = $this->admin(1, 'admin-a@example.test');
    $adminB = $this->admin(2, 'admin-b@example.test');

    $productA = $this->actingAs($adminA)
      ->withHeader('X-Store-ID', '1')
      ->postJson('/api/products', $this->product('SAME-SKU'))
      ->assertCreated()
      ->assertJsonPath('store_id', 1)
      ->json('id');

    $this->actingAs($adminB)
      ->withHeader('X-Store-ID', '2')
      ->getJson('/api/products')
      ->assertOk()
      ->assertJsonMissing(['id' => $productA]);

    $this->actingAs($adminB)
      ->withHeader('X-Store-ID', '2')
      ->postJson('/api/products', $this->product('SAME-SKU'))
      ->assertCreated()
      ->assertJsonPath('store_id', 2);

    $this->actingAs($adminB)
      ->withHeader('X-Store-ID', '2')
      ->patchJson('/api/products/' . $productA . '/active', ['active' => false])
      ->assertNotFound();

    $this->actingAs($adminA)
      ->withHeader('X-Store-ID', '2')
      ->getJson('/api/products')
      ->assertForbidden();
  }

  public function test_unassigned_legacy_rows_are_hidden_from_store_admins(): void
  {
    $admin = $this->admin(1, 'legacy-admin@example.test');
    DB::table('products')->insert([
      ...$this->product('LEGACY-NULL'),
      'created_at' => now(),
      'updated_at' => now(),
      'store_id' => null,
    ]);

    $this->actingAs($admin)
      ->withHeader('X-Store-ID', '1')
      ->getJson('/api/products')
      ->assertOk()
      ->assertJsonMissing(['sku' => 'LEGACY-NULL']);
  }

  public function test_super_admin_requires_explicit_permission(): void
  {
    $super = User::create([
      'name' => 'Platform operator',
      'email' => 'platform@example.test',
      'password' => 'password-123',
    ]);
    $permission = DB::table('permissions')->where('key', 'platform.data.read_all')->value('id');

    $this->actingAs($super)
      ->withHeader('X-Store-ID', '2')
      ->getJson('/api/products')
      ->assertForbidden();

    DB::table('user_permissions')->insert([
      'user_id' => $super->id,
      'permission_id' => $permission,
      'created_at' => now(),
      'updated_at' => now(),
    ]);

    $this->actingAs($super)->withHeader('X-Store-ID', '2')->getJson('/api/products')->assertOk();

    $this->actingAs($super)
      ->withHeader('X-Store-ID', '2')
      ->postJson('/api/products', $this->product('NO-WRITE'))
      ->assertForbidden();
  }

  public function test_platform_admin_can_create_admin_c_with_one_automatic_store_scope(): void
  {
    $platform = User::create([
      'name' => 'Platform operator',
      'email' => 'platform-create@example.test',
      'password' => 'password-123',
    ]);
    foreach (['platform.stores.manage', 'platform.memberships.manage'] as $key) {
      DB::table('user_permissions')->insert([
        'user_id' => $platform->id,
        'permission_id' => DB::table('permissions')->where('key', $key)->value('id'),
        'created_at' => now(),
        'updated_at' => now(),
      ]);
    }
    $created = $this->actingAs($platform)
      ->postJson('/api/platform/admins', [
        'name' => 'Admin C',
        'email' => 'admin-c@example.test',
        'password' => 'password-123',
        'password_confirmation' => 'password-123',
        'store' => ['code' => 'STORE-C', 'name' => 'Store C'],
      ])
      ->assertCreated()
      ->json();
    $this->assertDatabaseHas('store_memberships', [
      'id' => $created['membership_id'],
      'store_id' => $created['store_id'],
      'user_id' => $created['user_id'],
      'role' => 'admin',
      'status' => 'active',
    ]);
    $adminC = User::findOrFail($created['user_id']);
    $this->actingAs($adminC)
      ->postJson('/api/products', $this->product('ADMIN-C-SKU'))
      ->assertCreated()
      ->assertJsonPath('store_id', $created['store_id']);
    $this->actingAs($adminC)
      ->withHeader('X-Store-ID', '1')
      ->getJson('/api/products')
      ->assertForbidden();
  }
}
