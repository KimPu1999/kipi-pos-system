<?php
namespace Database\Seeders;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
class DatabaseSeeder extends Seeder
{
  public function run(): void
  {
    $products = [
      ['Flat white', 'COF-001', 'Coffee', 450, 45, '☕'],
      ['Matcha latte', 'COF-002', 'Coffee', 550, 32, '🍵'],
      ['Butter croissant', 'BAK-001', 'Bakery', 350, 24, '🥐'],
      ['Iced americano', 'COF-003', 'Coffee', 400, 38, '🧊'],
      ['Strawberry donut', 'BAK-002', 'Bakery', 300, 18, '🍩'],
      ['Chocolate cookie', 'BAK-003', 'Bakery', 250, 30, '🍪'],
      ['Fresh orange juice', 'DRK-001', 'Drinks', 500, 22, '🍊'],
      ['Avocado toast', 'FOD-001', 'Food', 850, 16, '🥑'],
      ['Blueberry muffin', 'BAK-004', 'Bakery', 375, 20, '🧁'],
    ];
    foreach ($products as [$name, $sku, $category, $price, $stock, $emoji]) {
      DB::table('products')->insertOrIgnore([
        'name' => $name,
        'sku' => $sku,
        'category' => $category,
        'price_cents' => $price,
        'stock' => $stock,
        'emoji' => $emoji,
        'created_at' => now(),
        'updated_at' => now(),
      ]);
    }
  }
}
