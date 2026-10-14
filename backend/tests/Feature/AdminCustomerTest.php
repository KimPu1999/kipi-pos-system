<?php
namespace Tests\Feature;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;
class AdminCustomerTest extends TestCase
{
  use RefreshDatabase;
  private function admin(int $storeId, string $email): User
  {
    $admin = User::create([
      'name' => 'Admin',
      'email' => $email,
      'password' => 'password-123',
    ]);
    $admin->role = 'admin';
    $admin->save();
    DB::table('store_memberships')->insert([
      'store_id' => $storeId,
      'user_id' => $admin->id,
      'role' => 'admin',
      'status' => 'active',
      'created_at' => now(),
      'updated_at' => now(),
    ]);
    return $admin;
  }
  public function test_customers_are_created_and_managed_only_inside_the_admin_store(): void
  {
    $adminA = $this->admin(1, 'admin-a-control@example.test');
    $adminB = $this->admin(2, 'admin-b-control@example.test');
    $customerId = $this->actingAs($adminA)
      ->postJson('/api/admin/customers', [
        'name' => 'Store A customer',
        'email' => 'customer-a@example.test',
        'password' => 'password-123',
        'password_confirmation' => 'password-123',
        'customer_number' => 'A-100',
        'store_notes' => 'Store A only',
      ])
      ->assertCreated()
      ->assertJsonPath('customer_number', 'A-100')
      ->json('id');
    $this->assertDatabaseHas('store_customers', [
      'store_id' => 1,
      'user_id' => $customerId,
      'status' => 'active',
    ]);
    $this->actingAs($adminA)
      ->getJson('/api/admin/customers')
      ->assertOk()
      ->assertJsonFragment(['id' => $customerId]);
    $this->actingAs($adminB)
      ->getJson('/api/admin/customers')
      ->assertOk()
      ->assertJsonMissing(['id' => $customerId]);
    $this->actingAs($adminB)
      ->getJson('/api/admin/customers/' . $customerId)
      ->assertNotFound();
    $this->actingAs($adminB)
      ->putJson('/api/admin/customers/' . $customerId, [
        'status' => 'inactive',
        'customer_number' => 'B-ATTACK',
      ])
      ->assertNotFound();
    $this->actingAs($adminA)
      ->putJson('/api/admin/customers/' . $customerId, [
        'status' => 'active',
        'customer_number' => 'A-101',
        'store_notes' => 'Updated locally',
      ])
      ->assertOk()
      ->assertJsonPath('customer_number', 'A-101');
    $before = User::findOrFail($customerId)->only(['name', 'email', 'role']);
    $this->actingAs($adminA)
      ->deleteJson('/api/admin/customers/' . $customerId)
      ->assertOk();
    $this->assertDatabaseHas('store_customers', [
      'store_id' => 1,
      'user_id' => $customerId,
      'status' => 'inactive',
    ]);
    $this->assertSame($before, User::findOrFail($customerId)->only(['name', 'email', 'role']));
  }
}
