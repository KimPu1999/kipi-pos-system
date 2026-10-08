<?php
namespace Tests\Feature;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
class AnnouncementTest extends TestCase
{
  use RefreshDatabase;
  public function test_admin_announcements_are_read_independently_by_customers(): void
  {
    $admin = User::create([
      'name' => 'Admin',
      'email' => 'announce-admin@example.com',
      'password' => 'password-123',
    ]);
    $admin->role = 'admin';
    $admin->save();
    $customer = User::create([
      'name' => 'Customer',
      'email' => 'announce-customer@example.com',
      'password' => 'password-123',
    ]);
    $id = $this->actingAs($admin)
      ->postJson('/api/announcements', [
        'title' => 'Opening hours',
        'message' => 'We close at 8 PM.',
      ])
      ->assertCreated()
      ->json('id');
    $this->actingAs($customer)
      ->getJson('/api/announcements')
      ->assertOk()
      ->assertJsonPath('0.title', 'Opening hours')
      ->assertJsonPath('0.read_at', null);
    $this->postJson('/api/announcements/' . $id . '/read')->assertOk();
    $this->getJson('/api/announcements')->assertJsonPath(
      '0.read_at',
      fn($value) => is_string($value) && $value !== '',
    );
    $this->deleteJson('/api/announcements/' . $id)->assertForbidden();
    $this->actingAs($admin)
      ->deleteJson('/api/announcements/' . $id)
      ->assertOk();
  }
}
