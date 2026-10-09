<?php
namespace Tests\Feature;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;
class PromotionTest extends TestCase
{
  use RefreshDatabase;
  public function test_discount_applies_to_order_edit_and_paid_sale(): void
  {
    $admin = User::create([
      'name' => 'Admin',
      'email' => 'admin@example.com',
      'password' => 'password-123',
    ]);
    $admin->role = 'admin';
    $admin->save();
    $this->actingAs($admin);
    $promo = $this->postJson('/api/promotions', [
      'code' => 'save10',
      'name' => 'Save ten',
      'percent' => 10,
    ])
      ->assertCreated()
      ->assertJsonPath('code', 'SAVE10')
      ->json('id');
    $p = DB::table('products')->insertGetId([
      'name' => 'Coffee',
      'sku' => 'COF',
      'category' => 'Drinks',
      'price_cents' => 450,
      'stock' => 10,
    ]);
    $customer = User::create([
      'name' => 'Customer',
      'email' => 'customer@example.com',
      'password' => 'password-123',
    ]);
    $this->actingAs($customer);
    $this->postJson('/api/promotions', [
      'code' => 'X',
      'name' => 'X',
      'percent' => 100,
    ])->assertForbidden();
    $id = $this->postJson('/api/orders', [
      'service_type' => 'dine_in',
      'promotion_code' => 'save10',
      'items' => [['product_id' => $p, 'quantity' => 2]],
      'discount_cents' => 899,
    ])
      ->assertCreated()
      ->assertJsonPath('subtotal_cents', 900)
      ->assertJsonPath('discount_cents', 90)
      ->assertJsonPath('total_cents', 810)
      ->json('id');
    $this->putJson('/api/orders/' . $id, ['items' => [['product_id' => $p, 'quantity' => 1]]])
      ->assertOk()
      ->assertJsonPath('total_cents', 405)
      ->assertJsonPath('discount_cents', 45);
    $this->postJson('/api/orders', [
      'promotion_code' => 'INVALID',
      'items' => [['product_id' => $p, 'quantity' => 1]],
    ])->assertUnprocessable();
    $this->assertDatabaseHas('products', ['id' => $p, 'stock' => 9]);
    $this->postJson('/api/orders/' . $id . '/confirm')->assertOk();
    $this->actingAs($admin);
    foreach (['confirmed', 'ready', 'completed'] as $status) {
      $this->patchJson('/api/orders/' . $id, ['status' => $status])->assertOk();
    }
    $this->assertDatabaseHas('sales', [
      'total_cents' => 405,
      'subtotal_cents' => 450,
      'discount_cents' => 45,
      'promotion_code' => 'SAVE10',
    ]);
    $this->patchJson('/api/promotions/' . $promo, ['active' => false])->assertOk();
    $this->actingAs($customer);
    $this->getJson('/api/promotions')->assertExactJson([]);
    $this->postJson('/api/orders', [
      'promotion_code' => 'SAVE10',
      'items' => [['product_id' => $p, 'quantity' => 1]],
    ])->assertUnprocessable();
  }
  public function test_expired_and_invalid_percent_discounts_are_rejected(): void
  {
    $u = User::create([
      'name' => 'Admin',
      'email' => 'admin@example.com',
      'password' => 'password-123',
    ]);
    $u->role = 'admin';
    $u->save();
    $this->actingAs($u);
    $this->postJson('/api/promotions', [
      'code' => 'BAD',
      'name' => 'Bad',
      'percent' => 101,
    ])->assertUnprocessable();
    DB::table('promotions')->insert([
      'code' => 'OLD',
      'name' => 'Expired',
      'percent' => 50,
      'active' => true,
      'expires_on' => '2020-01-01',
    ]);
    $p = DB::table('products')->insertGetId([
      'name' => 'Coffee',
      'sku' => 'COF',
      'category' => 'Coffee',
      'price_cents' => 450,
      'stock' => 3,
    ]);
    $this->postJson('/api/orders', [
      'promotion_code' => 'OLD',
      'items' => [['product_id' => $p, 'quantity' => 1]],
    ])->assertUnprocessable();
    $this->assertDatabaseHas('products', ['id' => $p, 'stock' => 3]);
    $this->assertDatabaseCount('orders', 0);
  }
  public function test_promotion_images_upload_replace_and_hide_when_inactive(): void
  {
    \Illuminate\Support\Facades\Storage::fake('local');
    $admin = User::create([
      'name' => 'Admin',
      'email' => 'imageadmin@example.com',
      'password' => 'password-123',
    ]);
    $admin->role = 'admin';
    $admin->save();
    $this->actingAs($admin);
    $image = fn() => \Illuminate\Http\UploadedFile::fake()->createWithContent(
      'offer.png',
      base64_decode(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG1cAAAAASUVORK5CYII=',
      ),
    );
    $r = $this->post(
      '/api/promotions',
      ['code' => 'OFFER', 'name' => 'Offer', 'percent' => '10', 'image' => $image()],
      ['Accept' => 'application/json'],
    )->assertCreated();
    $id = $r->json('id');
    $old = $r->json('image_path');
    $this->get('/api/promotions/' . $id . '/image')
      ->assertOk()
      ->assertHeader('Content-Type', 'image/png');
    $this->post(
      '/api/promotions/' . $id . '/image',
      ['image' => $image()],
      ['Accept' => 'application/json'],
    )->assertOk();
    \Illuminate\Support\Facades\Storage::disk('local')->assertMissing($old);
    $this->post(
      '/api/promotions/' . $id . '/image',
      ['image' => \Illuminate\Http\UploadedFile::fake()->createWithContent('file.txt', 'invalid')],
      ['Accept' => 'application/json'],
    )->assertUnprocessable();
    $customer = User::create([
      'name' => 'Customer',
      'email' => 'imagecustomer@example.com',
      'password' => 'password-123',
    ]);
    $this->actingAs($customer);
    $this->get('/api/promotions/' . $id . '/image')->assertOk();
    $this->post(
      '/api/promotions/' . $id . '/image',
      ['image' => $image()],
      ['Accept' => 'application/json'],
    )->assertForbidden();
    $this->actingAs($admin);
    $this->patchJson('/api/promotions/' . $id, ['active' => false])->assertOk();
    $this->actingAs($customer);
    $this->get('/api/promotions/' . $id . '/image')->assertNotFound();
  }
  public function test_admin_can_edit_confirm_and_delete_promotion(): void
  {
    $admin = User::create([
      'name' => 'Admin',
      'email' => 'actions@example.com',
      'password' => 'password-123',
    ]);
    $admin->role = 'admin';
    $admin->save();
    $this->actingAs($admin);
    $id = $this->postJson('/api/promotions', [
      'code' => 'EDIT10',
      'name' => 'Offer',
      'percent' => 10,
    ])
      ->assertCreated()
      ->json('id');
    $this->post(
      '/api/promotions/' . $id,
      [
        '_method' => 'PUT',
        'code' => 'EDIT10',
        'name' => 'New offer',
        'percent' => '20',
        'expires_on' => '',
      ],
      ['Accept' => 'application/json'],
    )
      ->assertOk()
      ->assertJsonPath('percent', 20)
      ->assertJsonPath('name', 'New offer');
    $this->patchJson('/api/promotions/' . $id, ['active' => false])->assertOk();
    $this->patchJson('/api/promotions/' . $id, ['active' => true])->assertOk();
    $p = DB::table('products')->insertGetId([
      'name' => 'Coffee',
      'sku' => 'TEST',
      'category' => 'Drinks',
      'price_cents' => 1000,
      'stock' => 5,
    ]);
    $o = $this->postJson('/api/orders', [
      'promotion_code' => 'EDIT10',
      'items' => [['product_id' => $p, 'quantity' => 1]],
    ])
      ->assertCreated()
      ->assertJsonPath('total_cents', 800)
      ->json('id');
    $this->deleteJson('/api/promotions/' . $id)->assertOk();
    $this->getJson('/api/promotions')->assertExactJson([]);
    $this->assertDatabaseHas('orders', [
      'id' => $o,
      'discount_cents' => 200,
      'total_cents' => 800,
      'promotion_code' => 'EDIT10',
    ]);
    $this->patchJson('/api/promotions/' . $id, ['active' => true])->assertNotFound();
    $this->postJson('/api/orders', [
      'promotion_code' => 'EDIT10',
      'items' => [['product_id' => $p, 'quantity' => 1]],
    ])->assertUnprocessable();
    $customer = User::create([
      'name' => 'Customer',
      'email' => 'deletecustomer@example.com',
      'password' => 'password-123',
    ]);
    $this->actingAs($customer);
    $this->deleteJson('/api/promotions/' . $id)->assertForbidden();
    $this->putJson('/api/promotions/' . $id, [])->assertForbidden();
  }
  public function test_linked_promotion_discounts_only_eligible_products(): void
  {
    $u = User::create([
      'name' => 'Admin',
      'email' => 'linked@example.com',
      'password' => 'password-123',
    ]);
    $u->role = 'admin';
    $u->save();
    $this->actingAs($u);
    $p = DB::table('products')->insertGetId([
      'name' => 'Coffee',
      'sku' => 'COFFEE',
      'category' => 'Drinks',
      'price_cents' => 1000,
      'stock' => 5,
    ]);
    $other = DB::table('products')->insertGetId([
      'name' => 'Cake',
      'sku' => 'CAKE',
      'category' => 'Food',
      'price_cents' => 2000,
      'stock' => 5,
    ]);
    $id = $this->post(
      '/api/promotions',
      [
        'name' => 'Coffee deal',
        'code' => 'COFFEE20',
        'percent' => 20,
        'product_ids' => json_encode([$p]),
      ],
      ['Accept' => 'application/json'],
    )
      ->assertCreated()
      ->assertJsonPath('product_ids.0', $p)
      ->json('id');
    $this->postJson('/api/orders', [
      'promotion_code' => 'COFFEE20',
      'items' => [['product_id' => $p, 'quantity' => 1], ['product_id' => $other, 'quantity' => 1]],
    ])
      ->assertCreated()
      ->assertJsonPath('subtotal_cents', 3000)
      ->assertJsonPath('discount_cents', 200)
      ->assertJsonPath('total_cents', 2800);
    $this->postJson('/api/orders', [
      'promotion_code' => 'COFFEE20',
      'items' => [['product_id' => $other, 'quantity' => 1]],
    ])->assertUnprocessable();
    $this->assertDatabaseHas('products', ['id' => $other, 'stock' => 4]);
    $this->putJson('/api/promotions/' . $id, [
      'name' => 'Storewide',
      'code' => 'COFFEE20',
      'percent' => 20,
      'product_ids' => [],
    ])
      ->assertOk()
      ->assertJsonPath('product_ids', []);
    $this->postJson('/api/orders', [
      'promotion_code' => 'COFFEE20',
      'items' => [['product_id' => $other, 'quantity' => 1]],
    ])
      ->assertCreated()
      ->assertJsonPath('discount_cents', 400);
    $this->postJson('/api/promotions', [
      'name' => 'Invalid',
      'code' => 'INVALID',
      'percent' => 10,
      'product_ids' => [999999],
    ])->assertUnprocessable();
  }
  public function test_category_promotion_discounts_only_eligible_categories(): void
  {
    $u = User::create([
      'name' => 'Admin',
      'email' => 'catpromo@example.com',
      'password' => 'password-123',
    ]);
    $u->role = 'admin';
    $u->save();
    $this->actingAs($u);
    $coffee = DB::table('products')->insertGetId([
      'name' => 'Coffee',
      'sku' => 'COFFEE2',
      'category' => 'Drinks',
      'price_cents' => 1000,
      'stock' => 5,
    ]);
    $soda = DB::table('products')->insertGetId([
      'name' => 'Soda',
      'sku' => 'SODA2',
      'category' => 'Drinks',
      'price_cents' => 1000,
      'stock' => 5,
    ]);
    $cake = DB::table('products')->insertGetId([
      'name' => 'Cake',
      'sku' => 'CAKE2',
      'category' => 'Food',
      'price_cents' => 2000,
      'stock' => 5,
    ]);
    $id = $this->post(
      '/api/promotions',
      [
        'name' => 'Drinks weekend',
        'code' => 'DRINKS20',
        'percent' => 20,
        'categories' => json_encode(['Drinks']),
      ],
      ['Accept' => 'application/json'],
    )
      ->assertCreated()
      ->assertJsonPath('categories.0', 'Drinks')
      ->json('id');
    $this->postJson('/api/orders', [
      'promotion_code' => 'DRINKS20',
      'items' => [
        ['product_id' => $coffee, 'quantity' => 1],
        ['product_id' => $soda, 'quantity' => 1],
        ['product_id' => $cake, 'quantity' => 1],
      ],
    ])
      ->assertCreated()
      ->assertJsonPath('subtotal_cents', 4000)
      ->assertJsonPath('discount_cents', 400)
      ->assertJsonPath('total_cents', 3600);
    $this->postJson('/api/orders', [
      'promotion_code' => 'DRINKS20',
      'items' => [['product_id' => $cake, 'quantity' => 1]],
    ])->assertUnprocessable();
    $this->putJson('/api/promotions/' . $id, [
      'name' => 'Drinks weekend',
      'code' => 'DRINKS20',
      'percent' => 20,
      'categories' => [],
    ])
      ->assertOk()
      ->assertJsonPath('categories', []);
    $this->postJson('/api/orders', [
      'promotion_code' => 'DRINKS20',
      'items' => [['product_id' => $cake, 'quantity' => 1]],
    ])
      ->assertCreated()
      ->assertJsonPath('discount_cents', 400);
    $this->postJson('/api/promotions', [
      'name' => 'Too long category',
      'code' => 'TOOLONG',
      'percent' => 10,
      'categories' => [str_repeat('x', 61)],
    ])->assertUnprocessable();
  }
}
