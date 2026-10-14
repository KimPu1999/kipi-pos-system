<?php
namespace Tests\Feature;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
class AuthTest extends TestCase
{
  use RefreshDatabase;
  public function test_guests_cannot_access_pos(): void
  {
    foreach (['/api/products', '/api/sales', '/api/auth/user'] as $url) {
      $this->getJson($url)->assertUnauthorized();
    }
  }
  public function test_public_registration_is_disabled(): void
  {
    $this->postJson('/api/auth/register', [
      'name' => 'Alex',
      'email' => 'alex@example.com',
      'password' => 'password-123',
      'password_confirmation' => 'password-123',
    ])
      ->assertForbidden()
      ->assertJsonPath('message', 'Please contact your store administrator to create an account.');
    $this->assertGuest();
    $this->assertDatabaseCount('users', 0);
  }
  public function test_login_and_logout(): void
  {
    User::create(['name' => 'Alex', 'email' => 'alex@example.com', 'password' => 'password-123']);
    $this->postJson('/api/auth/login', [
      'email' => 'alex@example.com',
      'password' => 'wrong',
    ])->assertUnprocessable();
    $this->assertGuest();
    $this->postJson('/api/auth/login', [
      'email' => 'alex@example.com',
      'password' => 'password-123',
    ])->assertOk();
    $this->assertAuthenticated();
    $this->postJson('/api/auth/logout')->assertOk();
    $this->assertGuest();
    $this->getJson('/api/products')->assertUnauthorized();
  }
  public function test_real_csrf_protection(): void
  {
    User::create(['name' => 'Alex', 'email' => 'alex@example.com', 'password' => 'password-123']);
    $this->app['env'] = 'local';
    $this->postJson('/api/auth/login', [
      'email' => 'alex@example.com',
      'password' => 'password-123',
    ])->assertStatus(419);
    $token = $this->getJson('/api/auth/csrf')->assertOk()->json('token');
    $this->withHeader('X-CSRF-TOKEN', $token)
      ->postJson('/api/auth/login', [
        'email' => 'alex@example.com',
        'password' => 'password-123',
      ])
      ->assertOk();
  }
}
