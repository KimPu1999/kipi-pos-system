<?php
namespace Tests\Feature;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
class DiningTableTest extends TestCase
{
  use RefreshDatabase;
  public function test_areas_can_be_renamed_and_removed_without_losing_tables(): void
  {
    $admin = User::create([
      'name' => 'Admin',
      'email' => 'areaadmin@example.com',
      'password' => 'password-123',
    ]);
    $admin->role = 'admin';
    $admin->save();
    $this->actingAs($admin);
    $this->postJson('/api/dining-tables', [
      'name' => 'A',
      'seats' => 4,
      'status' => 'occupied',
      'area' => 'Outdoor',
    ])->assertCreated();
    $this->postJson('/api/dining-tables', [
      'name' => 'B',
      'seats' => 4,
      'status' => 'available',
      'area' => 'Ground floor',
    ])->assertCreated();
    $this->putJson('/api/table-areas', ['area' => 'Outdoor', 'name' => 'Garden'])->assertOk();
    $this->assertDatabaseHas('dining_tables', [
      'name' => 'A',
      'area' => 'Garden',
      'status' => 'occupied',
    ]);
    $this->deleteJson('/api/table-areas', [
      'area' => 'Garden',
      'move_to' => 'Missing',
    ])->assertUnprocessable();
    $this->deleteJson('/api/table-areas', [
      'area' => 'Garden',
      'move_to' => 'Ground floor',
    ])->assertOk();
    $this->assertDatabaseCount('dining_tables', 2);
    $this->assertDatabaseHas('dining_tables', [
      'name' => 'A',
      'area' => 'Ground floor',
      'status' => 'occupied',
    ]);
    $this->actingAs(
      User::create([
        'name' => 'Customer',
        'email' => 'areacustomer@example.com',
        'password' => 'password-123',
      ]),
    );
    $this->putJson('/api/table-areas', [
      'area' => 'Ground floor',
      'name' => 'Test',
    ])->assertForbidden();
    $this->deleteJson('/api/table-areas', [
      'area' => 'Ground floor',
      'move_to' => 'Test',
    ])->assertForbidden();
  }
  public function test_pos_records_order_type_and_table(): void
  {
    $admin = User::create([
      'name' => 'Admin',
      'email' => 'postable@example.com',
      'password' => 'password-123',
    ]);
    $admin->role = 'admin';
    $admin->save();
    $this->actingAs($admin);
    $table = $this->postJson('/api/dining-tables', [
      'name' => 'Table POS',
      'seats' => 4,
      'status' => 'available',
    ])->json('id');
    $product = $this->postJson('/api/products', [
      'name' => 'Coffee',
      'sku' => 'POSCOF',
      'category' => 'Drinks',
      'price_cents' => 500,
      'stock' => 5,
      'emoji' => '☕',
      'active' => true,
    ])->json('id');
    $body = [
      'service_type' => 'dine_in',
      'payment_method' => 'cash',
      'items' => [['product_id' => $product, 'quantity' => 1]],
    ];
    $this->postJson('/api/sales', $body)->assertUnprocessable();
    $this->assertDatabaseHas('products', ['id' => $product, 'stock' => 5]);
    $this->postJson('/api/sales', [...$body, 'dining_table_id' => $table])
      ->assertCreated()
      ->assertJsonPath('table_name', 'Table POS')
      ->assertJsonPath('service_type', 'dine_in');
    $contact = [
      'name' => 'Alex',
      'email' => 'alex@example.com',
      'phone' => '091234567',
      'location' => 'Yangon',
      'zip_code' => '11181',
    ];
    $this->postJson('/api/sales', [
      ...$body,
      'service_type' => 'takeaway',
      'dining_table_id' => $table,
      'contact' => $contact,
    ])
      ->assertCreated()
      ->assertJsonPath('table_name', null)
      ->assertJsonPath('service_type', 'takeaway')
      ->assertJsonPath('contact_name', 'Alex')
      ->assertJsonPath('phone', '091234567')
      ->assertJsonPath('location', 'Yangon');
    $this->postJson('/api/sales', [
      ...$body,
      'service_type' => 'takeaway',
      'contact' => ['name' => 'Incomplete'],
    ])->assertUnprocessable();
    $this->postJson('/api/sales', [...$body, 'dining_table_id' => $table, 'contact' => $contact])
      ->assertCreated()
      ->assertJsonPath('contact_name', null);
  }
  public function test_dine_in_order_saves_table_and_rejects_unavailable_table(): void
  {
    $admin = User::create([
      'name' => 'Admin',
      'email' => 'orderstable@example.com',
      'password' => 'password-123',
    ]);
    $admin->role = 'admin';
    $admin->save();
    $this->actingAs($admin);
    $table = $this->postJson('/api/dining-tables', [
      'name' => 'Table 01',
      'seats' => 4,
      'status' => 'available',
    ])->json('id');
    $product = $this->postJson('/api/products', [
      'name' => 'Coffee',
      'sku' => 'TABLECOF',
      'category' => 'Drinks',
      'price_cents' => 500,
      'stock' => 5,
      'emoji' => '☕',
      'active' => true,
    ])->json('id');
    $buyer = User::create([
      'name' => 'Buyer',
      'email' => 'tablebuyer@example.com',
      'password' => 'password-123',
    ]);
    $this->actingAs($buyer);
    $body = [
      'service_type' => 'dine_in',
      'dining_table_id' => $table,
      'items' => [['product_id' => $product, 'quantity' => 1]],
    ];
    $this->postJson('/api/orders', $body)
      ->assertCreated()
      ->assertJsonPath('table_name', 'Table 01');
    $this->getJson('/api/orders')->assertJsonPath('0.table_name', 'Table 01');
    \Illuminate\Support\Facades\DB::table('dining_tables')
      ->where('id', $table)
      ->update(['status' => 'occupied']);
    $this->postJson('/api/orders', $body)->assertUnprocessable();
    $this->assertDatabaseHas('products', ['id' => $product, 'stock' => 4]);
    $this->getJson('/api/available-tables')->assertExactJson([]);
  }
  public function test_bulk_add_skips_existing_names_and_accepts_up_to_100(): void
  {
    $admin = User::create([
      'name' => 'Admin',
      'email' => 'bulktable@example.com',
      'password' => 'password-123',
    ]);
    $admin->role = 'admin';
    $admin->save();
    $this->actingAs($admin);
    $this->postJson('/api/dining-tables/bulk', ['count' => 15, 'seats' => 4])
      ->assertCreated()
      ->assertJsonPath('created', 15);
    $this->assertDatabaseHas('dining_tables', ['name' => 'Table 15', 'seats' => 4]);
    $this->postJson('/api/dining-tables/bulk', ['count' => 100, 'seats' => 6])->assertCreated();
    $this->assertDatabaseCount('dining_tables', 115);
    $this->assertDatabaseHas('dining_tables', ['name' => 'Table 115', 'seats' => 6]);
    $this->postJson('/api/dining-tables/bulk', [
      'count' => 101,
      'seats' => 4,
    ])->assertUnprocessable();
    $this->actingAs(
      User::create([
        'name' => 'Customer',
        'email' => 'bulktablecustomer@example.com',
        'password' => 'password-123',
      ]),
    );
    $this->postJson('/api/dining-tables/bulk', ['count' => 15, 'seats' => 4])->assertForbidden();
  }
  public function test_table_management_validation_and_permissions(): void
  {
    $admin = User::create([
      'name' => 'Admin',
      'email' => 'tableadmin@example.com',
      'password' => 'password-123',
    ]);
    $admin->role = 'admin';
    $admin->save();
    $this->actingAs($admin);
    $body = ['name' => 'Table 01', 'seats' => 4, 'status' => 'available'];
    $id = $this->postJson('/api/dining-tables', $body)->assertCreated()->json('id');
    $this->postJson('/api/dining-tables', $body)->assertUnprocessable();
    $this->postJson('/api/dining-tables', [
      ...$body,
      'name' => 'Bad',
      'seats' => 0,
    ])->assertUnprocessable();
    $this->putJson('/api/dining-tables/' . $id, [...$body, 'status' => 'occupied'])->assertOk();
    $this->deleteJson('/api/dining-tables/' . $id)->assertStatus(409);
    $this->putJson('/api/dining-tables/' . $id, $body)->assertOk();
    $this->getJson('/api/dining-tables')->assertJsonPath('0.seats', 4);
    $this->actingAs(
      User::create([
        'name' => 'Customer',
        'email' => 'tablecustomer@example.com',
        'password' => 'password-123',
      ]),
    );
    $this->getJson('/api/dining-tables')->assertForbidden();
    $this->deleteJson('/api/dining-tables/' . $id)->assertForbidden();
    $this->actingAs($admin);
    $this->deleteJson('/api/dining-tables/' . $id)->assertOk();
    $this->assertDatabaseCount('dining_tables', 0);
  }
}
