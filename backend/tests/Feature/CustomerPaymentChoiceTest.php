<?php
namespace Tests\Feature;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;
class CustomerPaymentChoiceTest extends TestCase
{
  use RefreshDatabase;
  public function test_customer_can_choose_cash_card_or_online_wallet(): void
  {
    $admin = User::create([
      'name' => 'Admin',
      'email' => 'payments-admin@example.com',
      'password' => 'password-123',
    ]);
    $admin->role = 'admin';
    $admin->save();
    $this->actingAs($admin);
    $product = $this->postJson('/api/products', [
      'name' => 'Tea',
      'sku' => 'PAY-1',
      'category' => 'Drinks',
      'price_cents' => 500000,
      'stock' => 10,
      'emoji' => '🫖',
      'active' => true,
    ])
      ->assertCreated()
      ->json('id');
    $buyer = User::create([
      'name' => 'Buyer',
      'email' => 'payments-buyer@example.com',
      'password' => 'password-123',
    ]);
    $this->actingAs($buyer);
    foreach (['cash', 'card'] as $choice) {
      $this->postJson('/api/orders', [
        'payment_choice' => $choice,
        'service_type' => 'dine_in',
        'items' => [['product_id' => $product, 'quantity' => 1]],
      ])
        ->assertCreated()
        ->assertJsonPath('payment_choice', $choice)
        ->assertJsonPath('transfer_provider', null);
    }
    $this->postJson('/api/orders', [
      'payment_choice' => 'transfer',
      'transfer_provider' => 'ayapay',
      'service_type' => 'dine_in',
      'items' => [['product_id' => $product, 'quantity' => 1]],
    ])
      ->assertCreated()
      ->assertJsonPath('payment_choice', 'transfer')
      ->assertJsonPath('transfer_provider', 'ayapay')
      ->assertJsonPath('transfer_name', 'Thawng Kim Piang')
      ->assertJsonPath('transfer_phone', '09428981899');
    $this->assertSame(3, DB::table('orders')->count());
  }
}
