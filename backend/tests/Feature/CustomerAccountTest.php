<?php
namespace Tests\Feature;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;
class CustomerAccountTest extends TestCase
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
  private function customer(string $email): User
  {
    $user = User::create(['name' => 'Customer', 'email' => $email, 'password' => 'password-123']);
    $user->role = 'customer';
    $user->save();
    return $user;
  }
  private function link(int $storeId, int $userId, string $status = 'active'): void
  {
    DB::table('store_customers')->insert([
      'store_id' => $storeId,
      'user_id' => $userId,
      'status' => $status,
      'created_at' => now(),
      'updated_at' => now(),
    ]);
  }
  public function test_admin_created_customer_is_hashed_and_not_auto_signed_in(): void
  {
    $admin = $this->admin(1, 'owner@example.test');
    $this->actingAs($admin);
    $id = $this->postJson('/api/admin/customers', [
      'name' => 'New Customer',
      'email' => 'new-customer@example.test',
      'password' => 'temporary-123',
      'password_confirmation' => 'temporary-123',
    ])
      ->assertCreated()
      ->assertJsonMissingPath('password')
      ->assertJsonPath('role', 'customer')
      ->json('id');
    $this->assertDatabaseHas('users', ['id' => $id, 'role' => 'customer']);
    $this->assertDatabaseHas('store_customers', [
      'store_id' => 1,
      'user_id' => $id,
      'status' => 'active',
    ]);
    $this->assertTrue(Hash::check('temporary-123', User::findOrFail($id)->password));
    // Creating a customer must not hijack the administrator's own session.
    $this->getJson('/api/auth/user')->assertOk()->assertJsonPath('id', $admin->id);
    $this->assertAuthenticatedAs($admin);
  }
  public function test_customer_role_cannot_be_escalated_through_admin_create(): void
  {
    $admin = $this->admin(1, 'escalation@example.test');
    $id = $this->actingAs($admin)
      ->postJson('/api/admin/customers', [
        'name' => 'Sneaky',
        'email' => 'sneaky@example.test',
        'password' => 'password-123',
        'password_confirmation' => 'password-123',
        'role' => 'admin',
      ])
      ->assertCreated()
      ->json('id');
    $this->assertDatabaseHas('users', ['id' => $id, 'role' => 'customer']);
    $this->assertDatabaseMissing('store_memberships', ['user_id' => $id]);
  }
  public function test_created_customer_requires_explicit_login_with_their_credentials(): void
  {
    $this->customer('login-customer@example.test');
    $this->link(1, User::where('email', 'login-customer@example.test')->value('id'));
    $this->postJson('/api/auth/login', [
      'email' => 'login-customer@example.test',
      'password' => 'wrong-password',
    ])
      ->assertUnprocessable()
      ->assertJsonValidationErrors('email');
    $this->assertGuest();
    $this->postJson('/api/auth/login', [
      'email' => 'login-customer@example.test',
      'password' => 'password-123',
    ])->assertOk();
    $this->assertAuthenticatedAs(User::where('email', 'login-customer@example.test')->first());
  }
  public function test_customer_deactivated_across_all_stores_cannot_log_in(): void
  {
    $customer = $this->customer('inactive@example.test');
    $this->link(1, $customer->id, 'inactive');
    $this->postJson('/api/auth/login', [
      'email' => 'inactive@example.test',
      'password' => 'password-123',
    ])
      ->assertUnprocessable()
      ->assertJsonValidationErrors('email');
    $this->assertGuest();
  }
  public function test_customer_active_in_another_store_can_still_log_in(): void
  {
    $customer = $this->customer('multi@example.test');
    $this->link(1, $customer->id, 'inactive');
    $this->link(2, $customer->id, 'active');
    $this->postJson('/api/auth/login', [
      'email' => 'multi@example.test',
      'password' => 'password-123',
    ])->assertOk();
    $this->assertAuthenticatedAs($customer);
  }
  public function test_removing_customer_from_one_store_preserves_login_and_other_store(): void
  {
    $admin = $this->admin(1, 'remove-admin@example.test');
    $customerId = $this->actingAs($admin)
      ->postJson('/api/admin/customers', [
        'name' => 'Shared',
        'email' => 'shared@example.test',
        'password' => 'password-123',
        'password_confirmation' => 'password-123',
      ])
      ->assertCreated()
      ->json('id');
    $adminB = $this->admin(2, 'remove-admin-b@example.test');
    $this->actingAs($adminB);
    $this->link(2, $customerId);
    $this->actingAs($admin)
      ->deleteJson('/api/admin/customers/' . $customerId)
      ->assertOk();
    $this->assertDatabaseHas('users', ['id' => $customerId, 'role' => 'customer']);
    $this->assertDatabaseHas('store_customers', [
      'store_id' => 2,
      'user_id' => $customerId,
      'status' => 'active',
    ]);
    // Still linked to store 2, so the global account keeps working.
    $this->postJson('/api/auth/login', [
      'email' => 'shared@example.test',
      'password' => 'password-123',
    ])->assertOk();
  }
  public function test_legacy_customer_without_store_link_can_still_log_in(): void
  {
    $this->customer('legacy@example.test');
    $this->postJson('/api/auth/login', [
      'email' => 'legacy@example.test',
      'password' => 'password-123',
    ])->assertOk();
  }
  public function test_admin_login_and_logout_still_work(): void
  {
    $admin = $this->admin(1, 'login-admin@example.test');
    $this->postJson('/api/auth/login', [
      'email' => 'login-admin@example.test',
      'password' => 'password-123',
    ])->assertOk();
    $this->assertAuthenticatedAs($admin);
    $this->postJson('/api/auth/logout')->assertOk();
    $this->assertGuest();
  }
}
