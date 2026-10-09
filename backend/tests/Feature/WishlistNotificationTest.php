<?php
namespace Tests\Feature;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
class WishlistNotificationTest extends TestCase
{
  use RefreshDatabase;
  private function adminWithProduct(array $overrides = []): int
  {
    $admin = User::create([
      'name' => 'Admin',
      'email' => 'wn-admin@example.com',
      'password' => 'password-123',
    ])->refresh();
    $admin->role = 'admin';
    $admin->save();
    $this->actingAs($admin);
    return (int) $this->postJson('/api/products', [
      'name' => 'Restock Coffee',
      'sku' => 'WNREST',
      'category' => 'Drinks',
      'price_cents' => 100000,
      'stock' => 0,
      'emoji' => '☕',
      'active' => true,
      ...$overrides,
    ])->assertCreated()->json('id');
  }
  private function admin(): User
  {
    return User::where('email', 'wn-admin@example.com')->first();
  }
  public function test_restocking_a_wishlisted_product_notifies_customers_and_admin(): void
  {
    $product = $this->adminWithProduct();
    $unwished = $this->postJson('/api/products', [
      'name' => 'Untouched',
      'sku' => 'WNIGNORE',
      'category' => 'Food',
      'price_cents' => 50000,
      'stock' => 0,
      'emoji' => '🥐',
      'active' => true,
    ])->assertCreated()->json('id');
    $first = User::create([
      'name' => 'First',
      'email' => 'wn-first@example.com',
      'password' => 'password-123',
    ]);
    $second = User::create([
      'name' => 'Second',
      'email' => 'wn-second@example.com',
      'password' => 'password-123',
    ]);
    $this->actingAs($first);
    $this->postJson('/api/wishlist/' . $product)->assertOk();
    $this->getJson('/api/wishlist/notifications')->assertJsonPath('unread', 0);
    $this->actingAs($second);
    $this->postJson('/api/wishlist/' . $product)->assertOk();
    $this->postJson('/api/wishlist/' . $unwished)->assertOk();
    $this->actingAs($this->admin());
    $this->patchJson('/api/products/' . $product . '/stock', [
      'stock' => 8,
      'expected_stock' => 0,
    ])->assertOk();
    $this->assertDatabaseCount('wishlist_notifications', 3);
    $this->assertDatabaseHas('wishlist_notifications', [
      'user_id' => $first->id,
      'product_id' => $product,
      'type' => 'back_in_stock',
      'read_at' => null,
    ]);
    $this->assertDatabaseHas('wishlist_notifications', [
      'user_id' => $second->id,
      'product_id' => $product,
      'customer_count' => 0,
    ]);
    $this->assertDatabaseHas('wishlist_notifications', [
      'user_id' => $this->admin()->id,
      'product_id' => $product,
      'customer_count' => 2,
    ]);
    $this->actingAs($first);
    $notice = $this->getJson('/api/wishlist/notifications');
    $notice->assertJsonPath('unread', 1);
    $notice->assertJsonPath('notifications.0.product_name', 'Restock Coffee');
    $notice->assertJsonPath('notifications.0.read_at', null);
    $this->postJson('/api/wishlist/notifications/read')->assertJsonPath('unread', 0);
    $this->getJson('/api/wishlist/notifications')->assertJsonPath('unread', 0);
    $this->actingAs($this->admin());
    $adminNotice = $this->getJson('/api/wishlist/notifications');
    $adminNotice->assertJsonPath('unread', 1);
    $adminNotice->assertJsonPath('notifications.0.customer_count', 2);
    $this->postJson('/api/wishlist/notifications/read')->assertJsonPath('unread', 0);
  }
  public function test_no_notification_when_restocking_an_unwishlisted_product(): void
  {
    $product = $this->adminWithProduct();
    $this->patchJson('/api/products/' . $product . '/stock', [
      'stock' => 5,
      'expected_stock' => 0,
    ])->assertOk();
    $this->assertDatabaseCount('wishlist_notifications', 0);
  }
  public function test_edit_form_restock_also_notifies(): void
  {
    $product = $this->adminWithProduct();
    User::create([
      'name' => 'Lover',
      'email' => 'wn-lover@example.com',
      'password' => 'password-123',
    ]);
    $this->actingAs(User::where('email', 'wn-lover@example.com')->first());
    $this->postJson('/api/wishlist/' . $product)->assertOk();
    $this->actingAs($this->admin());
    $this->putJson('/api/products/' . $product, [
      'name' => 'Restock Coffee',
      'sku' => 'WNREST',
      'category' => 'Drinks',
      'price_cents' => 100000,
      'stock' => 12,
      'expected_stock' => 0,
      'emoji' => '☕',
      'active' => true,
    ])->assertOk();
    $this->assertDatabaseCount('wishlist_notifications', 2);
  }
}