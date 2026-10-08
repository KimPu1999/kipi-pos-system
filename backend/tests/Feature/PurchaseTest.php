<?php
namespace Tests\Feature;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
class PurchaseTest extends TestCase
{
  use RefreshDatabase;
  public function test_receiving_adds_stock_records_cost_and_retry_does_not_duplicate(): void
  {
    $admin = User::create([
      'name' => 'Admin',
      'email' => 'purchase@example.com',
      'password' => 'password-123',
    ]);
    $admin->role = 'admin';
    $admin->save();
    $this->actingAs($admin);
    $product = $this->postJson('/api/products', [
      'name' => 'Coffee',
      'sku' => 'P1',
      'category' => 'Drinks',
      'price_cents' => 500,
      'stock' => 3,
      'emoji' => '☕',
      'active' => true,
    ])
      ->assertCreated()
      ->json('id');
    $body = [
      'supplier' => 'Supplier One',
      'reference' => 'INV-1',
      'purchased_on' => '2026-10-06',
      'request_id' => 'bb81d22f-bc08-4c68-b952-d7c8c3ded891',
      'items' => [['product_id' => $product, 'quantity' => 5, 'unit_cost_cents' => 120]],
    ];
    $this->postJson('/api/purchases', $body)->assertCreated()->assertJsonPath('total_cents', 600);
    $this->postJson('/api/purchases', $body)->assertCreated();
    $this->assertDatabaseHas('products', ['id' => $product, 'stock' => 8]);
    $this->assertDatabaseCount('purchases', 1);
    $this->assertDatabaseCount('purchase_items', 1);
    $purchase = $this->getJson('/api/purchases')
      ->assertOk()
      ->assertJsonPath('0.items.0.name', 'Coffee')
      ->json('0');
    $edit = [
      'supplier' => 'Updated supplier',
      'purchased_on' => '2026-10-07',
      'items' => [['id' => $purchase['items'][0]['id'], 'unit_cost_cents' => 150]],
    ];
    $this->putJson('/api/purchases/' . $purchase['id'], $edit)
      ->assertOk()
      ->assertJsonPath('total_cents', 750);
    $this->assertDatabaseHas('products', ['id' => $product, 'stock' => 8]);
    $this->postJson('/api/purchases/' . $purchase['id'] . '/payment', [
      'payment_method' => 'bank_transfer',
    ])
      ->assertOk()
      ->assertJsonPath('payment_status', 'paid');
    $this->assertDatabaseHas('cash_entries', [
      'type' => 'out',
      'payment_status' => 'paid',
      'amount_cents' => 750,
      'source_type' => 'purchase',
      'source_id' => $purchase['id'],
    ]);
    $this->postJson('/api/purchases/' . $purchase['id'] . '/payment', [
      'payment_method' => 'cash',
    ])->assertStatus(409);
    $this->assertDatabaseCount('cash_entries', 1);
    $this->putJson('/api/purchases/' . $purchase['id'], [...$edit, 'supplier' => 'Paid supplier'])
      ->assertOk()
      ->assertJsonPath('supplier', 'Paid supplier')
      ->assertJsonPath('payment_status', 'paid');

    $body['request_id'] = '4c79f8a8-307e-4aa3-8c37-4472d15e867a';
    $body['items'][] = ['product_id' => 999999, 'quantity' => 1, 'unit_cost_cents' => 100];
    $this->postJson('/api/purchases', $body)->assertUnprocessable();
    $this->assertDatabaseHas('products', ['id' => $product, 'stock' => 8]);
    $this->actingAs(
      User::create([
        'name' => 'Customer',
        'email' => 'buyer@example.com',
        'password' => 'password-123',
      ]),
    );
    $this->putJson('/api/purchases/' . $purchase['id'], $edit)->assertForbidden();
    $this->postJson('/api/purchases/' . $purchase['id'] . '/payment', [
      'payment_method' => 'cash',
    ])->assertForbidden();
    $this->getJson('/api/purchases')->assertForbidden();
    $this->postJson('/api/purchases', $body)->assertForbidden();
  }
}
