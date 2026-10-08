<?php
namespace Tests\Feature;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
class ProductEditTest extends TestCase
{
  use RefreshDatabase;
  protected function setUp(): void
  {
    parent::setUp();
    $user = User::create([
      'name' => 'Admin',
      'email' => 'admin@example.com',
      'password' => 'password-123',
    ]);
    $user->role = 'admin';
    $user->save();
    $this->actingAs($user);
  }
  private function body(): array
  {
    return [
      'name' => 'Coffee',
      'sku' => 'COF1',
      'category' => 'Drinks',
      'price_cents' => 450,
      'stock' => 8,
      'emoji' => '☕',
      'active' => true,
    ];
  }
  public function test_missing_sku_is_generated_and_custom_codes_are_preserved(): void
  {
    $body = $this->body();
    unset($body['sku']);
    $a = $this->postJson('/api/products', $body)->assertCreated()->json('sku');
    $b = $this->postJson('/api/products', [...$body, 'sku' => ''])
      ->assertCreated()
      ->json('sku');
    $this->assertStringStartsWith('PRD-', $a);
    $this->assertNotSame($a, $b);
    $this->postJson('/api/products', [...$body, 'sku' => 'CUSTOM-001'])
      ->assertCreated()
      ->assertJsonPath('sku', 'CUSTOM-001');
    $this->postJson('/api/products', [...$body, 'sku' => 'CUSTOM-001'])->assertUnprocessable();
  }
  public function test_edit_with_same_sku_saves_all_fields_and_inactive_state(): void
  {
    $id = $this->postJson('/api/products', $this->body())->assertCreated()->json('id');
    $this->post(
      '/api/products/' . $id,
      [
        ...$this->body(),
        '_method' => 'PUT',
        'name' => 'Latte',
        'price_cents' => '550',
        'stock' => '12',
        'active' => '0',
      ],
      ['Accept' => 'application/json'],
    )
      ->assertOk()
      ->assertJsonPath('name', 'Latte');
    $this->assertDatabaseHas('products', [
      'id' => $id,
      'name' => 'Latte',
      'price_cents' => 550,
      'stock' => 12,
      'active' => 0,
    ]);
    $this->getJson('/api/catalog')->assertExactJson([]);
    $this->patchJson('/api/products/' . $id . '/active', ['active' => true])->assertOk();
    $this->getJson('/api/catalog')->assertJsonPath('0.name', 'Latte');
    $this->assertDatabaseHas('products', [
      'id' => $id,
      'price_cents' => 550,
      'stock' => 12,
      'active' => 1,
    ]);
  }
  public function test_activation_validation_and_customer_permissions(): void
  {
    $id = $this->postJson('/api/products', $this->body())->json('id');
    $this->patchJson('/api/products/' . $id . '/active', [
      'active' => 'invalid',
    ])->assertUnprocessable();
    $this->patchJson('/api/products/99999/active', ['active' => false])->assertNotFound();
    $customer = User::create([
      'name' => 'Customer',
      'email' => 'customer@example.com',
      'password' => 'password-123',
    ]);
    $this->actingAs($customer);
    $this->patchJson('/api/products/' . $id . '/active', ['active' => false])->assertForbidden();
    $this->putJson('/api/products/' . $id, $this->body())->assertForbidden();
    $this->assertDatabaseHas('products', ['id' => $id, 'active' => 1]);
  }
  public function test_stock_can_be_corrected_and_stale_updates_are_rejected(): void
  {
    $id = $this->postJson('/api/products', $this->body())->json('id');
    $this->patchJson('/api/products/' . $id . '/stock', ['stock' => 0, 'expected_stock' => 8])
      ->assertOk()
      ->assertJsonPath('stock', 0);
    $this->patchJson('/api/products/' . $id . '/stock', [
      'stock' => 20,
      'expected_stock' => 8,
    ])->assertStatus(409);
    $this->assertDatabaseHas('products', ['id' => $id, 'stock' => 0]);
    $this->patchJson('/api/products/' . $id . '/stock', [
      'stock' => 10,
      'expected_stock' => 0,
    ])->assertOk();
    $this->patchJson('/api/products/' . $id . '/stock', [
      'stock' => 10,
      'expected_stock' => 10,
    ])->assertOk();
    $this->patchJson('/api/products/' . $id . '/stock', [
      'stock' => -1,
      'expected_stock' => 10,
    ])->assertUnprocessable();
    $this->actingAs(
      User::create([
        'name' => 'Customer',
        'email' => 'stockcustomer@example.com',
        'password' => 'password-123',
      ]),
    );
    $this->patchJson('/api/products/' . $id . '/stock', [
      'stock' => 100,
      'expected_stock' => 10,
    ])->assertForbidden();
    $this->assertDatabaseHas('products', ['id' => $id, 'stock' => 10]);
  }
}
