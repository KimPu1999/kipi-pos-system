<?php
namespace Tests\Feature;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
class SettingsTest extends TestCase
{
  use RefreshDatabase;
  public function test_settings_are_validated_and_admin_only(): void
  {
    $settings = $this->getJson('/api/settings')->assertOk()->json();
    $user = User::create([
      'name' => 'Customer',
      'email' => 'settings@example.com',
      'password' => 'password-123',
    ]);
    $this->actingAs($user);
    $this->putJson('/api/settings', $settings)->assertForbidden();
    $this->getJson('/api/settings/system')->assertForbidden();
    $user->role = 'admin';
    $user->save();
    $this->actingAs($user);
    $this->putJson('/api/settings', [...$settings, 'accent' => 'invalid'])->assertUnprocessable();
    $this->putJson('/api/settings', [
      ...$settings,
      'store_name' => 'My Store',
      'font_size' => 18,
      'font_family' => 'manrope',
    ])->assertOk();
    $this->getJson('/api/settings')
      ->assertJsonPath('store_name', 'My Store')
      ->assertJsonPath('font_size', 18)
      ->assertJsonPath('font_family', 'manrope');
    $this->getJson('/api/settings/system')->assertOk()->assertJsonPath('currency', 'MMK');
  }
}
