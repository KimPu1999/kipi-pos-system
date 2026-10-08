<?php
namespace Tests\Feature;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
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
  public function test_registration_hashes_password_and_signs_in(): void
  {
    $this->postJson('/api/auth/register', [
      'name' => 'Alex',
      'email' => 'alex@example.com',
      'password' => 'password-123',
      'password_confirmation' => 'password-123',
    ])
      ->assertCreated()
      ->assertJsonMissingPath('password');
    $this->assertAuthenticated();
    $this->assertTrue(Hash::check('password-123', User::first()->password));
    $this->getJson('/api/auth/user')->assertOk()->assertJsonPath('name', 'Alex');
    $this->getJson('/api/catalog')->assertOk();
    $this->getJson('/api/products')->assertForbidden();
  }
  public function test_registration_validation(): void
  {
    User::create(['name' => 'Alex', 'email' => 'alex@example.com', 'password' => 'password-123']);
    $this->postJson('/api/auth/register', [
      'name' => 'Alex',
      'email' => 'alex@example.com',
      'password' => 'short',
      'password_confirmation' => 'other',
    ])
      ->assertUnprocessable()
      ->assertJsonValidationErrors(['email', 'password']);
    $this->assertDatabaseCount('users', 1);
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
    $this->app['env'] = 'local';
    $this->postJson('/api/auth/login', [
      'email' => 'alex@example.com',
      'password' => 'password-123',
    ])->assertStatus(419);
    $token = $this->getJson('/api/auth/csrf')->assertOk()->json('token');
    $this->withHeader('X-CSRF-TOKEN', $token)
      ->postJson('/api/auth/register', [
        'name' => 'Alex',
        'email' => 'alex@example.com',
        'password' => 'password-123',
        'password_confirmation' => 'password-123',
      ])
      ->assertCreated();
  }
}
