<?php
namespace Tests\Feature;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
class CustomerRewardsTest extends TestCase
{
  use RefreshDatabase;
  public function test_paid_orders_earn_points_once_and_history_is_private(): void
  {
    $admin = User::create([
      'name' => 'Admin',
      'email' => 'rewardadmin@example.com',
      'password' => 'password-123',
    ]);
    $admin->role = 'admin';
    $admin->save();
    $this->actingAs($admin);
    $id = $this->postJson('/api/products', [
      'name' => 'Coffee',
      'sku' => 'REW1',
      'category' => 'Drinks',
      'price_cents' => 450000,
      'stock' => 5,
      'emoji' => '☕',
      'active' => true,
    ])->json('id');
    $buyer = User::create([
      'name' => 'Buyer',
      'email' => 'rewardbuyer@example.com',
      'password' => 'password-123',
    ]);
    $this->actingAs($buyer);
    $order = $this->postJson('/api/orders', [
      'payment_choice' => 'card',
      'service_type' => 'dine_in',
      'items' => [['product_id' => $id, 'quantity' => 1]],
    ])
      ->assertCreated()
      ->json('id');
    $this->getJson('/api/customer/rewards')->assertJsonPath('points', 0);
    $this->postJson('/api/orders/' . $order . '/confirm')->assertOk();
    $this->actingAs($admin);
    foreach (['confirmed', 'ready', 'completed'] as $status) {
      $this->patchJson('/api/orders/' . $order, [
        'status' => $status,
        ...$status === 'completed'
          ? ['custom_discount_percent' => 10, 'payment_method' => 'card', 'card_confirmed' => true]
          : [],
      ])->assertOk();
    }
    $this->getJson('/api/orders')
      ->assertJsonPath('0.payment_choice', 'card')
      ->assertJsonPath('0.payment.payment_method', 'card')
      ->assertJsonPath('0.payment.amount_received_cents', null);
    $this->patchJson('/api/orders/' . $order, ['status' => 'completed'])->assertUnprocessable();
    $this->assertDatabaseCount('customer_points', 1);
    $this->getJson('/api/customer/rewards?customer_id=' . $buyer->id)->assertJsonPath('points', 4);
    $this->postJson('/api/sales', [
      'customer_id' => $buyer->id,
      'payment_method' => 'cash',
      'items' => [['product_id' => $id, 'quantity' => 1]],
    ])->assertCreated();
    $this->postJson('/api/sales', [
      'customer_id' => $admin->id,
      'payment_method' => 'cash',
      'items' => [['product_id' => $id, 'quantity' => 1]],
    ])->assertUnprocessable();
    $this->actingAs($buyer);
    $this->getJson('/api/customer/rewards')
      ->assertJsonPath('points', 8)
      ->assertJsonPath('spent_cents', 855000)
      ->assertJsonPath(
        'rule',
        'Earn 1 point for every whole 1,000 MMK spent after discounts. Redeem 1 point for 1 MMK.',
      )
      ->assertJsonPath('history.0.items.0.name', 'Coffee');
    $this->getJson('/api/customer/rewards?customer_id=' . $admin->id)->assertForbidden();
    $this->actingAs(
      User::create([
        'name' => 'Other',
        'email' => 'otherreward@example.com',
        'password' => 'password-123',
      ]),
    );
    $this->getJson('/api/customer/rewards')
      ->assertJsonPath('points', 0)
      ->assertJsonPath('history', []);
  }
  public function test_points_can_be_chosen_at_payment_and_cannot_be_reused(): void
  {
    $admin = User::create([
      'name' => 'Admin',
      'email' => 'points-admin@example.com',
      'password' => 'password-123',
    ])->refresh();
    $admin->role = 'admin';
    $admin->save();
    $this->actingAs($admin);
    $product = $this->postJson('/api/products', [
      'name' => 'Meal',
      'sku' => 'POINTPAY',
      'category' => 'Food',
      'price_cents' => 300000,
      'stock' => 3,
      'emoji' => '🍽️',
      'active' => true,
    ])
      ->assertCreated()
      ->json('id');
    $buyer = User::create([
      'name' => 'Buyer',
      'email' => 'points-buyer@example.com',
      'password' => 'password-123',
    ])->refresh();
    foreach ([false, true] as $usePoints) {
      $this->actingAs($buyer);
      $order = $this->postJson('/api/orders', [
        'payment_choice' => 'card',
        'service_type' => 'dine_in',
        'items' => [['product_id' => $product, 'quantity' => 1]],
      ])
        ->assertCreated()
        ->json('id');
      $this->postJson('/api/orders/' . $order . '/confirm')->assertOk();
      $this->actingAs($admin);
      $this->patchJson('/api/orders/' . $order, ['status' => 'confirmed'])->assertOk();
      $this->patchJson('/api/orders/' . $order, ['status' => 'ready'])->assertOk();
      $sale = $this->patchJson('/api/orders/' . $order, [
        'status' => 'completed',
        'payment_method' => 'card',
        'card_confirmed' => true,
        'use_points' => $usePoints,
      ])
        ->assertOk()
        ->json('sale_id');
      if ($usePoints) {
        $this->assertDatabaseHas('sales', [
          'id' => $sale,
          'redeemed_points' => 3,
          'point_discount_cents' => 300,
          'total_cents' => 299700,
        ]);
      }
    }
    $this->getJson('/api/customer/rewards?customer_id=' . $buyer->id)->assertJsonPath('points', 2);
  }
}
