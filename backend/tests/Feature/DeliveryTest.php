<?php
namespace Tests\Feature;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;
class DeliveryTest extends TestCase
{
  use RefreshDatabase;
  public function test_delivery_details_visibility_transitions_and_payment(): void
  {
    config(['mail.order_enabled' => true, 'mail.store_address' => 'store@example.com']);
    $customer = User::create([
      'name' => 'Customer',
      'email' => 'delivery@example.com',
      'password' => 'password-123',
    ]);
    $this->actingAs($customer);
    $p = DB::table('products')->insertGetId([
      'name' => 'Coffee',
      'sku' => 'COFFEE',
      'category' => 'Drinks',
      'price_cents' => 450,
      'stock' => 5,
    ]);
    $id = $this->postJson('/api/orders', [
      'service_type' => 'takeaway',
      'items' => [['product_id' => $p, 'quantity' => 1]],
    ])->json('id');
    $this->postJson('/api/orders/' . $id . '/confirm')->assertOk();
    $d = [
      'driver_name' => 'Driver',
      'driver_phone' => '+95 900000000',
      'delivery_location' => 'Yangon',
      'delivery_eta' => now()->addHour()->toIso8601String(),
      'delivery_status' => 'assigned',
    ];
    $this->patchJson('/api/orders/' . $id . '/delivery', $d)->assertForbidden();
    $admin = User::create([
      'name' => 'Admin',
      'email' => 'deliveryadmin@example.com',
      'password' => 'password-123',
    ]);
    $admin->role = 'admin';
    $admin->save();
    $this->actingAs($admin);
    $this->patchJson('/api/orders/' . $id . '/delivery', $d)->assertStatus(409);
    foreach (['confirmed', 'ready'] as $status) {
      $this->patchJson('/api/orders/' . $id, ['status' => $status])->assertOk();
    }
    $this->patchJson('/api/orders/' . $id . '/delivery', [
      ...$d,
      'delivery_status' => 'delivered',
    ])->assertStatus(409);
    $this->patchJson('/api/orders/' . $id . '/delivery', $d)->assertOk();
    $this->patchJson('/api/orders/' . $id, ['status' => 'completed'])->assertStatus(409);
    $this->assertDatabaseCount('sales', 0);
    $this->actingAs($customer);
    $this->getJson('/api/orders')
      ->assertJsonPath('0.driver_name', 'Driver')
      ->assertJsonPath('0.delivery_location', 'Yangon');
    $this->actingAs($admin);
    $this->patchJson('/api/orders/' . $id . '/delivery', [
      ...$d,
      'delivery_status' => 'out_for_delivery',
    ])->assertOk();
    $this->assertNotNull(DB::table('orders')->find($id)->dispatched_at);
    $email = DB::table('order_emails')
      ->where('recipient', 'delivery@example.com')
      ->where('subject', 'Kipi POS · Your order #' . $id . ' delivery is coming')
      ->first();
    $this->assertNotNull($email);
    $this->assertStringContainsString('Your delivery is coming', $email->body);
    $this->assertStringContainsString('+95 900000000', $email->body);
    $this->assertStringContainsString('Yangon', $email->body);
    $this->patchJson('/api/orders/' . $id . '/delivery', [
      ...$d,
      'delivery_status' => 'delivered',
    ])->assertOk();
    $this->assertNotNull(DB::table('orders')->find($id)->delivered_at);
    $sale = $this->patchJson('/api/orders/' . $id, ['status' => 'completed'])
      ->assertOk()
      ->json('sale_id');
    $this->assertDatabaseCount('sales', 1);
    $this->assertDatabaseHas('products', ['id' => $p, 'stock' => 4]);
    $this->getJson('/api/sales')
      ->assertOk()
      ->assertJsonPath('0.id', $sale)
      ->assertJsonPath('0.order_id', $id)
      ->assertJsonPath('0.driver_name', 'Driver')
      ->assertJsonPath('0.delivery_location', 'Yangon')
      ->assertJsonPath('0.delivered_at', fn($value) => is_string($value) && $value !== '');
  }
}
