<?php
namespace Tests\Feature;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;
class ProductImageTest extends TestCase
{
  use RefreshDatabase;
  protected function setUp(): void
  {
    parent::setUp();
    Storage::fake('local');
    $u = User::create([
      'name' => 'Admin',
      'email' => 'admin@example.com',
      'password' => 'password-123',
    ]);
    $u->role = 'admin';
    $u->save();
    $this->actingAs($u);
  }
  private function image(): UploadedFile
  {
    return UploadedFile::fake()->createWithContent(
      'coffee.png',
      base64_decode(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG1cAAAAASUVORK5CYII=',
      ),
    );
  }
  public function test_upload_replacement_and_serving(): void
  {
    $body = [
      'name' => 'Coffee',
      'sku' => 'C001',
      'category' => 'Drinks',
      'price_cents' => 450,
      'stock' => 5,
      'emoji' => '☕',
      'active' => 1,
    ];
    $r = $this->post(
      '/api/products',
      [...$body, 'image' => $this->image()],
      ['Accept' => 'application/json'],
    )->assertCreated();
    $id = $r->json('id');
    $old = $r->json('image_path');
    Storage::disk('local')->assertExists($old);
    $this->get('/api/products/' . $id . '/image')
      ->assertOk()
      ->assertHeader('Content-Type', 'image/png');
    $this->post(
      '/api/products/' . $id,
      [...$body, '_method' => 'PUT', 'image' => $this->image()],
      ['Accept' => 'application/json'],
    )->assertOk();
    $new = DB::table('products')->where('id', $id)->value('image_path');
    $this->assertNotSame($old, $new);
    Storage::disk('local')->assertMissing($old);
    Storage::disk('local')->assertExists($new);
    $u = User::create([
      'name' => 'Customer',
      'email' => 'customer@example.com',
      'password' => 'password-123',
    ]);
    $this->actingAs($u);
    $this->get('/api/products/' . $id . '/image')->assertOk();
    $this->post(
      '/api/products',
      [...$body, 'image' => $this->image()],
      ['Accept' => 'application/json'],
    )->assertForbidden();
  }
  public function test_non_image_is_rejected_without_creating_product(): void
  {
    $this->post(
      '/api/products',
      [
        'name' => 'Coffee',
        'sku' => 'C001',
        'category' => 'Drinks',
        'price_cents' => 450,
        'stock' => 5,
        'image' => UploadedFile::fake()->createWithContent('file.txt', 'not an image'),
      ],
      ['Accept' => 'application/json'],
    )
      ->assertUnprocessable()
      ->assertJsonValidationErrors('image');
    $this->assertDatabaseCount('products', 0);
  }
}
