<?php
namespace Tests\Feature;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;
class NoteTest extends TestCase
{
  use RefreshDatabase;
  public function test_admin_can_manage_private_notes(): void
  {
    $admin = User::create([
      'name' => 'Admin',
      'email' => 'notes@example.com',
      'password' => 'password-123',
    ]);
    $admin->role = 'admin';
    $admin->save();
    $this->actingAs($admin);
    Storage::fake('local');
    $file = UploadedFile::fake()->create(
      'stock-plan.xlsx',
      20,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    $id = $this->post(
      '/api/notes',
      [
        'title' => 'Order supplies',
        'category' => 'Stock',
        'content' => 'Buy cups and bags.',
        'pinned' => true,
        'excel_file' => $file,
      ],
      ['Accept' => 'application/json'],
    )
      ->assertCreated()
      ->assertJsonPath('title', 'Order supplies')
      ->assertJsonPath('file_name', 'stock-plan.xlsx')
      ->json('id');
    $this->get('/api/notes/' . $id . '/file')
      ->assertOk()
      ->assertDownload('stock-plan.xlsx');
    $image = UploadedFile::fake()->image('reminder.jpg');
    $imageId = $this->post(
      '/api/notes',
      [
        'title' => 'Image reminder',
        'category' => 'Reminder',
        'content' => 'Photo attachment.',
        'pinned' => false,
        'excel_file' => $image,
      ],
      ['Accept' => 'application/json'],
    )
      ->assertCreated()
      ->assertJsonPath('file_name', 'reminder.jpg')
      ->json('id');
    $this->getJson('/api/notes')->assertOk()->assertJsonCount(2)->assertJsonPath('0.pinned', 1);
    $this->putJson('/api/notes/' . $id, [
      'title' => 'Updated supplies',
      'category' => 'Suppliers',
      'content' => 'Call supplier first.',
      'pinned' => false,
    ])
      ->assertOk()
      ->assertJsonPath('category', 'Suppliers');
    $this->deleteJson('/api/notes/' . $id)->assertOk();
    $this->deleteJson('/api/notes/' . $imageId)->assertOk();
    $this->assertDatabaseCount('notes', 0);
  }
  public function test_customers_cannot_access_admin_notebook(): void
  {
    $customer = User::create([
      'name' => 'Customer',
      'email' => 'notecustomer@example.com',
      'password' => 'password-123',
    ]);
    $this->actingAs($customer);
    $this->getJson('/api/notes')->assertForbidden();
    $this->postJson('/api/notes', [
      'title' => 'No',
      'category' => 'General',
      'content' => 'No',
      'pinned' => false,
    ])->assertForbidden();
  }
}
