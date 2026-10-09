<?php
namespace Tests\Feature;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;
class PortalTest extends TestCase
{
  use RefreshDatabase;
  private function user(string $role = 'customer'): User
  {
    $u = User::create([
      'name' => 'Test',
      'email' => uniqid() . '@example.com',
      'password' => 'password-123',
    ]);
    $u->role = $role;
    $u->save();
    return $u;
  }
  private function product(): int
  {
    return DB::table('products')->insertGetId([
      'name' => 'Coffee',
      'sku' => uniqid(),
      'category' => 'Coffee',
      'price_cents' => 450,
      'stock' => 5,
      'emoji' => '☕',
      'active' => true,
    ]);
  }
  public function test_customer_cannot_manage_store_or_escalate_role(): void
  {
    $this->postJson('/api/auth/register', [
      'name' => 'Alex',
      'email' => 'alex@example.com',
      'password' => 'password-123',
      'password_confirmation' => 'password-123',
      'role' => 'admin',
    ])
      ->assertCreated()
      ->assertJsonPath('role', 'customer');
    foreach (['/api/admin/dashboard', '/api/products', '/api/sales'] as $url) {
      $this->getJson($url)->assertForbidden();
    }
    $this->postJson('/api/products', [])->assertForbidden();
    $this->postJson('/api/sales', [])->assertForbidden();
  }
  public function test_order_reserves_stock_cancellation_restores_once_and_is_private(): void
  {
    $u = $this->user();
    $p = $this->product();
    $this->actingAs($u);
    $id = $this->postJson('/api/orders', [
      'items' => [['product_id' => $p, 'quantity' => 2]],
      'total_cents' => 1,
    ])
      ->assertCreated()
      ->assertJsonPath('total_cents', 900)
      ->json('id');
    $this->assertDatabaseHas('products', ['id' => $p, 'stock' => 3]);
    $this->actingAs($this->user());
    $this->getJson('/api/orders')->assertExactJson([]);
    $this->patchJson('/api/orders/' . $id, ['status' => 'cancelled'])->assertNotFound();
    $this->actingAs($u);
    $this->patchJson('/api/orders/' . $id, ['status' => 'cancelled'])->assertOk();
    $this->patchJson('/api/orders/' . $id, ['status' => 'cancelled'])->assertForbidden();
    $this->assertDatabaseHas('products', ['id' => $p, 'stock' => 5]);
  }
  public function test_admin_fulfillment_records_payment_without_deducting_stock_twice(): void
  {
    $p = $this->product();
    $this->actingAs($this->user());
    $id = $this->postJson('/api/orders', [
      'service_type' => 'dine_in',
      'items' => [['product_id' => $p, 'quantity' => 2]],
    ])
      ->assertCreated()
      ->json('id');
    $this->patchJson('/api/orders/' . $id, ['status' => 'completed'])->assertForbidden();
    $this->actingAs($this->user('admin'));
    $this->patchJson('/api/orders/' . $id, ['status' => 'completed'])->assertUnprocessable();
    foreach (['confirmed', 'ready', 'completed'] as $status) {
      $this->patchJson('/api/orders/' . $id, ['status' => $status])
        ->assertOk()
        ->assertJsonPath('status', $status);
    }
    $this->assertDatabaseHas('products', ['id' => $p, 'stock' => 3]);
    $this->assertDatabaseCount('sales', 1);
    $this->assertDatabaseHas('sales', ['total_cents' => 900, 'payment_method' => 'cash']);
    $this->patchJson('/api/orders/' . $id, ['status' => 'completed'])->assertUnprocessable();
    $this->assertDatabaseCount('sales', 1);
  }
  public function test_customer_can_choose_an_order_item_size_and_it_reaches_the_receipt(): void
  {
    $p = $this->product();
    DB::table('products')
      ->where('id', $p)
      ->update([
        'small_price_cents' => 300,
        'medium_price_cents' => 450,
        'large_price_cents' => 700,
      ]);
    $this->actingAs($this->user());
    $id = $this->postJson('/api/orders', [
      'service_type' => 'dine_in',
      'items' => [['product_id' => $p, 'quantity' => 1, 'size' => 'large']],
    ])
      ->assertCreated()
      ->assertJsonPath('items.0.size', 'large')
      ->assertJsonPath('items.0.price_cents', 700)
      ->assertJsonPath('total_cents', 700)
      ->json('id');
    $this->postJson('/api/orders', [
      'items' => [['product_id' => $p, 'quantity' => 1, 'size' => 'extra_large']],
    ])->assertUnprocessable();
    $this->actingAs($this->user('admin'));
    foreach (['confirmed', 'ready', 'completed'] as $status) {
      $this->patchJson('/api/orders/' . $id, ['status' => $status])->assertOk();
    }
    $this->assertDatabaseHas('order_items', [
      'order_id' => $id,
      'product_id' => $p,
      'size' => 'large',
    ]);
    $this->assertDatabaseHas('sale_items', [
      'product_id' => $p,
      'size' => 'large',
      'price_cents' => 700,
    ]);
  }
  public function test_archived_products_cannot_be_ordered(): void
  {
    $p = $this->product();
    $this->actingAs($this->user('admin'));
    $this->deleteJson('/api/products/' . $p)->assertOk();
    $this->actingAs($this->user());
    $this->getJson('/api/catalog')->assertExactJson([]);
    $this->postJson('/api/orders', [
      'items' => [['product_id' => $p, 'quantity' => 1]],
    ])->assertUnprocessable();
    $this->assertDatabaseCount('orders', 0);
    $this->assertDatabaseHas('products', ['id' => $p, 'stock' => 5]);
  }
  public function test_stock_failure_rolls_back_whole_customer_order(): void
  {
    $p = $this->product();
    $other = $this->product();
    DB::table('products')
      ->where('id', $other)
      ->update(['stock' => 0]);
    $this->actingAs($this->user());
    $this->postJson('/api/orders', [
      'items' => [['product_id' => $p, 'quantity' => 2], ['product_id' => $other, 'quantity' => 1]],
    ])->assertUnprocessable();
    $this->assertDatabaseHas('products', ['id' => $p, 'stock' => 5]);
    $this->assertDatabaseCount('orders', 0);
  }
  public function test_order_list_returns_latest_status_and_payment_details(): void
  {
    $p = $this->product();
    $customer = $this->user();
    $this->actingAs($customer);
    $id = $this->postJson('/api/orders', [
      'service_type' => 'dine_in',
      'items' => [['product_id' => $p, 'quantity' => 2]],
    ])
      ->assertCreated()
      ->json('id');
    $this->actingAs($this->user('admin'));
    $this->getJson('/api/orders')
      ->assertJsonPath('0.id', $id)
      ->assertJsonPath('0.status', 'pending');
    foreach (['confirmed', 'ready'] as $status) {
      $this->patchJson('/api/orders/' . $id, ['status' => $status])->assertOk();
    }
    $this->patchJson('/api/orders/' . $id, [
      'status' => 'completed',
      'amount_received_cents' => 100,
    ])->assertUnprocessable();
    $this->assertDatabaseCount('sales', 0);
    $this->assertDatabaseHas('orders', ['id' => $id, 'status' => 'ready']);
    $this->patchJson('/api/orders/' . $id, [
      'status' => 'completed',
      'amount_received_cents' => 1000,
    ])
      ->assertOk()
      ->assertJsonPath('payment.change_cents', 100);
    $this->actingAs($customer);
    $this->getJson('/api/orders')
      ->assertOk()
      ->assertJsonPath('0.status', 'completed')
      ->assertJsonPath('0.payment.amount_received_cents', 1000)
      ->assertJsonPath('0.payment.change_cents', 100);
    $this->assertDatabaseHas('products', ['id' => $p, 'stock' => 3]);
  }
  public function test_customer_can_edit_confirm_and_cancel_pending_order(): void
  {
    $p = $this->product();
    $customer = $this->user();
    $this->actingAs($customer);
    $id = $this->postJson('/api/orders', [
      'items' => [['product_id' => $p, 'quantity' => 2]],
    ])->json('id');
    $this->postJson('/api/orders/' . $id . '/confirm')->assertOk();
    $this->assertNotNull(DB::table('orders')->find($id)->customer_confirmed_at);
    $this->putJson('/api/orders/' . $id, [
      'note' => 'Later pickup',
      'items' => [['product_id' => $p, 'quantity' => 3]],
    ])
      ->assertOk()
      ->assertJsonPath('total_cents', 1350)
      ->assertJsonPath('customer_confirmed_at', null);
    $this->assertDatabaseHas('products', ['id' => $p, 'stock' => 2]);
    $this->putJson('/api/orders/' . $id, [
      'items' => [['product_id' => $p, 'quantity' => 99]],
    ])->assertUnprocessable();
    $this->assertDatabaseHas('products', ['id' => $p, 'stock' => 2]);
    $this->assertDatabaseHas('orders', ['id' => $id, 'total_cents' => 1350]);
    $this->actingAs($this->user());
    $this->putJson('/api/orders/' . $id, [
      'items' => [['product_id' => $p, 'quantity' => 1]],
    ])->assertNotFound();
    $this->postJson('/api/orders/' . $id . '/confirm')->assertNotFound();
    $this->actingAs($customer);
    $this->postJson('/api/orders/' . $id . '/confirm')->assertOk();
    $this->patchJson('/api/orders/' . $id, ['status' => 'cancelled'])->assertOk();
    $this->assertDatabaseHas('products', ['id' => $p, 'stock' => 5]);
    $this->putJson('/api/orders/' . $id, [
      'items' => [['product_id' => $p, 'quantity' => 1]],
    ])->assertStatus(409);
  }
  public function test_edit_and_customer_confirmation_stop_when_store_accepts_order(): void
  {
    $p = $this->product();
    $customer = $this->user();
    $this->actingAs($customer);
    $id = $this->postJson('/api/orders', [
      'items' => [['product_id' => $p, 'quantity' => 1]],
    ])->json('id');
    $this->postJson('/api/orders/' . $id . '/confirm')->assertOk();
    $this->actingAs($this->user('admin'));
    $this->patchJson('/api/orders/' . $id, ['status' => 'confirmed'])->assertOk();
    $this->actingAs($customer);
    $this->putJson('/api/orders/' . $id, [
      'items' => [['product_id' => $p, 'quantity' => 2]],
    ])->assertStatus(409);
    $this->postJson('/api/orders/' . $id . '/confirm')->assertStatus(409);
    $this->patchJson('/api/orders/' . $id, ['status' => 'cancelled'])->assertForbidden();
    $this->assertDatabaseHas('products', ['id' => $p, 'stock' => 4]);
  }
  public function test_order_status_timestamps_are_recorded_and_returned_in_utc(): void
  {
    $p = $this->product();
    $this->actingAs($this->user());
    $id = $this->postJson('/api/orders', [
      'service_type' => 'dine_in',
      'items' => [['product_id' => $p, 'quantity' => 1]],
    ])
      ->assertCreated()
      ->assertJsonPath('ready_at', null)
      ->json('id');
    $this->actingAs($this->user('admin'));
    $this->travelTo(\Illuminate\Support\Carbon::parse('2026-10-06 10:00:00', 'UTC'));
    $this->patchJson('/api/orders/' . $id, ['status' => 'confirmed'])
      ->assertOk()
      ->assertJsonPath('confirmed_at', '2026-10-06T10:00:00+00:00');
    $this->travel(5)->minutes();
    $this->patchJson('/api/orders/' . $id, ['status' => 'ready'])
      ->assertOk()
      ->assertJsonPath('ready_at', '2026-10-06T10:05:00+00:00');
    $this->travel(2)->minutes();
    $this->patchJson('/api/orders/' . $id, ['status' => 'completed'])
      ->assertOk()
      ->assertJsonPath('completed_at', '2026-10-06T10:07:00+00:00')
      ->assertJsonPath('ready_at', '2026-10-06T10:05:00+00:00');
    $this->travelBack();
  }
  public function test_order_contact_details_are_saved_updated_and_validated(): void
  {
    $p = $this->product();
    $this->actingAs($this->user());
    $c = [
      'name' => 'Pickup Person',
      'email' => 'pickup@example.com',
      'phone' => '+95 9123456789',
      'location' => 'Yangon',
      'zip_code' => '11181',
    ];
    $id = $this->postJson('/api/orders', [
      'items' => [['product_id' => $p, 'quantity' => 1]],
      'contact' => $c,
    ])
      ->assertCreated()
      ->assertJsonPath('customer_name', 'Pickup Person')
      ->assertJsonPath('phone', '+95 9123456789')
      ->assertJsonPath('zip_code', '11181')
      ->json('id');
    $this->putJson('/api/orders/' . $id, [
      'items' => [['product_id' => $p, 'quantity' => 1]],
      'contact' => [...$c, 'location' => 'Mandalay', 'zip_code' => '05011'],
    ])
      ->assertOk()
      ->assertJsonPath('location', 'Mandalay')
      ->assertJsonPath('zip_code', '05011');
    $this->postJson('/api/orders', [
      'items' => [['product_id' => $p, 'quantity' => 1]],
      'contact' => ['name' => 'Person', 'email' => 'invalid'],
    ])
      ->assertUnprocessable()
      ->assertJsonValidationErrors([
        'contact.email',
        'contact.phone',
        'contact.location',
        'contact.zip_code',
      ]);
    $this->assertDatabaseCount('orders', 1);
  }
  public function test_customer_can_choose_and_edit_service_type(): void
  {
    $p = $this->product();
    $this->actingAs($this->user());
    $id = $this->postJson('/api/orders', [
      'service_type' => 'dine_in',
      'items' => [['product_id' => $p, 'quantity' => 1]],
    ])
      ->assertCreated()
      ->assertJsonPath('service_type', 'dine_in')
      ->json('id');
    $this->putJson('/api/orders/' . $id, [
      'service_type' => 'takeaway',
      'items' => [['product_id' => $p, 'quantity' => 1]],
    ])
      ->assertOk()
      ->assertJsonPath('service_type', 'takeaway');
    $this->postJson('/api/orders', [
      'service_type' => 'invalid',
      'items' => [['product_id' => $p, 'quantity' => 1]],
    ])
      ->assertUnprocessable()
      ->assertJsonValidationErrors('service_type');
    $this->assertDatabaseCount('orders', 1);
  }
}
