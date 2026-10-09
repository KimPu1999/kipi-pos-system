<?php
namespace Tests\Feature;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
class WishlistTest extends TestCase
{
  use RefreshDatabase;
  public function test_products_can_be_wishlisted_and_removed_per_user(): void
  {
    $admin = User::create([
      'name' => 'Admin',
      'email' => 'wishlist-admin@example.com',
      'password' => 'password-123',
    ])->refresh();
    $admin->role = 'admin';
    $admin->save();
    $this->actingAs($admin);
    $product = $this->postJson('/api/products', [
      'name' => 'Tea',
      'sku' => 'WISH1',
      'category' => 'Drinks',
      'price_cents' => 150000,
      'stock' => 5,
      'emoji' => '🍵',
      'active' => true,
    ])
      ->assertCreated()
      ->json('id');
    $couple = $this->postJson('/api/products', [
      'name' => 'Cake',
      'sku' => 'WISH2',
      'category' => 'Dessert',
      'price_cents' => 200000,
      'stock' => 2,
      'emoji' => '🍰',
      'active' => true,
    ])
      ->assertCreated()
      ->json('id');
    $this->postJson('/api/wishlist/99999')->assertNotFound();
    $shop = User::create([
      'name' => 'Shopper',
      'email' => 'wishlist-shopper@example.com',
      'password' => 'password-123',
    ]);
    $browser = User::create([
      'name' => 'Browser',
      'email' => 'wishlist-browser@example.com',
      'password' => 'password-123',
    ]);
    $this->actingAs($shop);
    $this->getJson('/api/wishlist')->assertJson([]);
    $this->postJson('/api/wishlist/' . $product)->assertOk();
    $this->postJson('/api/wishlist/' . $product)->assertOk();
    $this->postJson('/api/wishlist/' . $couple)->assertOk();
    $this->getJson('/api/wishlist')->assertJsonPath('0', (int) $couple);
    $this->getJson('/api/wishlist')->assertJsonPath('1', (int) $product);
    $this->assertDatabaseCount('wishlists', 2);
    $this->deleteJson('/api/wishlist/' . $product)->assertOk();
    $this->getJson('/api/wishlist')->assertJsonPath('0', (int) $couple);
    $this->actingAs($browser);
    $this->getJson('/api/wishlist')->assertJson([]);
  }
}