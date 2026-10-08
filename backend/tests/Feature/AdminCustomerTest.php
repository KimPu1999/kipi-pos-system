<?php
namespace Tests\Feature;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;
class AdminCustomerTest extends TestCase
{
  use RefreshDatabase;
  public function test_admin_can_edit_and_remove_customer_login(): void
  {
    $admin = User::create([
      'name' => 'Admin',
      'email' => 'admin-control@example.com',
      'password' => 'password-123',
    ])->refresh();
    $admin->role = 'admin';
    $admin->save();
    $customer = User::create([
      'name' => 'Customer',
      'email' => 'customer-control@example.com',
      'password' => 'password-123',
    ])->refresh();
    $this->actingAs($customer)
      ->putJson('/api/admin/customers/' . $customer->id, [
        'name' => 'Blocked',
        'email' => 'blocked@example.com',
      ])
      ->assertForbidden();
    $this->actingAs($admin)
      ->putJson('/api/admin/customers/' . $customer->id, [
        'name' => 'Updated Customer',
        'email' => 'updated@example.com',
        'password' => 'new-password-456',
        'password_confirmation' => 'new-password-456',
      ])
      ->assertOk()
      ->assertJsonPath('name', 'Updated Customer');
    $this->assertTrue(Hash::check('new-password-456', $customer->fresh()->password));
    $this->deleteJson('/api/admin/customers/' . $customer->id)->assertOk();
    $deleted = $customer->fresh();
    $this->assertSame('deleted', $deleted->role);
    $this->assertSame('Deleted customer', $deleted->name);
    $this->assertStringContainsString('@deleted.invalid', $deleted->email);
  }
}
