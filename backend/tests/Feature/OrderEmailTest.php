<?php
namespace Tests\Feature;
use App\Models\User;
use App\Services\OrderEmails;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;
class OrderEmailTest extends TestCase
{
  use RefreshDatabase;
  public function test_order_email_outbox_and_delivery(): void
  {
    config([
      'mail.order_enabled' => true,
      'mail.default' => 'smtp',
      'mail.store_address' => 'store@example.com',
    ]);
    Mail::fake();
    $admin = User::create([
      'name' => 'Admin',
      'email' => 'adminmail@example.com',
      'password' => 'password-123',
    ]);
    $admin->role = 'admin';
    $admin->save();
    $this->actingAs($admin);
    $id = $this->postJson('/api/products', [
      'name' => 'Coffee',
      'sku' => 'MAIL1',
      'category' => 'Drinks',
      'price_cents' => 400,
      'stock' => 5,
      'emoji' => '☕',
      'active' => true,
    ])
      ->assertCreated()
      ->json('id');
    $customer = User::create([
      'name' => 'Buyer',
      'email' => 'buyer@example.com',
      'password' => 'password-123',
    ]);
    $this->actingAs($customer);
    $order = $this->postJson('/api/orders', [
      'service_type' => 'dine_in',
      'items' => [['product_id' => $id, 'quantity' => 1]],
    ])
      ->assertCreated()
      ->json('id');
    $this->assertDatabaseCount('order_emails', 2);
    $this->assertDatabaseHas('order_emails', [
      'recipient' => 'buyer@example.com',
      'order_id' => $order,
    ]);
    $this->postJson('/api/orders/' . $order . '/confirm')->assertOk();
    $this->assertDatabaseCount('order_emails', 4);
    $this->assertDatabaseHas('order_emails', [
      'recipient' => 'store@example.com',
      'subject' => 'Kipi POS · Order #' . $order . ' — Customer confirmed order',
    ]);
    $this->postJson('/api/orders/' . $order . '/confirm')->assertOk();
    $this->assertDatabaseCount('order_emails', 4);
    $this->actingAs($admin);
    $this->patchJson('/api/orders/' . $order, ['status' => 'ready'])->assertUnprocessable();
    $this->assertDatabaseCount('order_emails', 4);
    $this->patchJson('/api/orders/' . $order, ['status' => 'confirmed'])->assertOk();
    $this->assertDatabaseCount('order_emails', 6);
    $this->assertDatabaseHas('order_emails', [
      'recipient' => 'buyer@example.com',
      'order_id' => $order,
      'subject' => 'Kipi POS · Your order #' . $order . ' is confirmed',
    ]);
    $confirmation = \Illuminate\Support\Facades\DB::table('order_emails')
      ->where('recipient', 'buyer@example.com')
      ->where('subject', 'Kipi POS · Your order #' . $order . ' is confirmed')
      ->first();
    $this->assertStringContainsString('Your order is confirmed!', $confirmation->body);
    $this->assertStringContainsString('1 × Coffee', $confirmation->body);
    $this->assertSame(['sent' => 6, 'failed' => 0], OrderEmails::sendPending());
    $this->assertSame(['sent' => 0, 'failed' => 0], OrderEmails::sendPending());
    config(['mail.order_enabled' => false]);
    $this->patchJson('/api/orders/' . $order, ['status' => 'ready'])->assertOk();
    $this->assertDatabaseCount('order_emails', 6);
  }
}
