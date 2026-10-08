<?php
namespace Tests\Feature;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
class CashEntryTest extends TestCase
{
  use RefreshDatabase;
  public function test_admin_can_record_list_and_delete_cash_entries(): void
  {
    $admin = User::create([
      'name' => 'Admin',
      'email' => 'cashadmin@example.com',
      'password' => 'password-123',
    ]);
    $admin->role = 'admin';
    $admin->save();
    $this->actingAs($admin);
    $in = $this->postJson('/api/cash-entries', [
      'type' => 'in',
      'payment_status' => 'paid',
      'amount_cents' => 1000000,
      'category' => 'Opening balance',
      'entry_date' => '2026-10-07',
    ])
      ->assertCreated()
      ->json('id');
    $out = $this->postJson('/api/cash-entries', [
      'type' => 'out',
      'payment_status' => 'unpaid',
      'amount_cents' => 250000,
      'category' => 'Supplies',
      'reference' => 'INV-1',
      'entry_date' => '2026-10-07',
      'note' => 'Cups',
    ])
      ->assertCreated()
      ->json('id');
    $this->getJson('/api/cash-entries')
      ->assertOk()
      ->assertJsonPath('cash_in_cents', 1000000)
      ->assertJsonPath('cash_out_cents', 0)
      ->assertJsonPath('unpaid_cents', 250000)
      ->assertJsonPath('balance_cents', 1000000)
      ->assertJsonCount(2, 'entries');
    $this->postJson('/api/cash-entries/' . $out . '/payment')
      ->assertOk()
      ->assertJsonPath('payment_status', 'paid');
    $this->getJson('/api/cash-entries')
      ->assertJsonPath('cash_out_cents', 250000)
      ->assertJsonPath('balance_cents', 750000);
    $this->putJson('/api/cash-entries/' . $out, [
      'type' => 'out',
      'payment_status' => 'paid',
      'amount_cents' => 200000,
      'category' => 'Updated supplies',
      'reference' => 'INV-2',
      'entry_date' => '2026-10-08',
      'note' => 'Edited',
    ])
      ->assertOk()
      ->assertJsonPath('category', 'Updated supplies');
    $this->getJson('/api/cash-entries')
      ->assertJsonPath('cash_out_cents', 200000)
      ->assertJsonPath('balance_cents', 800000);
    $this->get('/api/cash-entries/export')
      ->assertOk()
      ->assertHeader(
        'content-type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
    $this->get('/api/cash-entries/export-pdf')
      ->assertOk()
      ->assertHeader('content-type', 'application/pdf');
    $this->get('/api/cash-entries/export-pdf?filter=unpaid')
      ->assertOk()
      ->assertDownload('kipi-cash-history-unpaid-' . now()->format('Y-m-d') . '.pdf');
    $this->get('/api/cash-entries/export-pdf?filter=purchase')->assertOk();
    $this->get('/api/cash-entries/export-pdf?filter=employee')->assertOk();
    $this->get('/api/cash-entries/export-pdf?filter=manual')->assertOk();
    $this->getJson('/api/cash-entries/export-pdf?filter=invalid')->assertUnprocessable();
    $this->deleteJson('/api/cash-entries/' . $in)->assertOk();
    $this->assertDatabaseCount('cash_entries', 1);
  }
  public function test_customers_cannot_manage_cash_entries_and_values_are_validated(): void
  {
    $customer = User::create([
      'name' => 'Customer',
      'email' => 'cashcustomer@example.com',
      'password' => 'password-123',
    ]);
    $this->actingAs($customer);
    $this->getJson('/api/cash-entries')->assertForbidden();
    $this->get('/api/cash-entries/export')->assertForbidden();
    $this->get('/api/cash-entries/export-pdf')->assertForbidden();
    $this->postJson('/api/cash-entries', [
      'type' => 'in',
      'amount_cents' => 100,
      'category' => 'Test',
      'entry_date' => '2026-10-07',
    ])->assertForbidden();
    $admin = User::create([
      'name' => 'Admin',
      'email' => 'cashvalidation@example.com',
      'password' => 'password-123',
    ]);
    $admin->role = 'admin';
    $admin->save();
    $this->actingAs($admin);
    $this->postJson('/api/cash-entries', [
      'type' => 'bad',
      'amount_cents' => 0,
      'category' => '',
      'entry_date' => 'bad',
    ])->assertUnprocessable();
  }
}
