<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
  public function up(): void
  {
    Schema::table('products', function (Blueprint $table) {
      $table->unsignedInteger('small_price_cents')->nullable()->after('price_cents');
      $table->unsignedInteger('medium_price_cents')->nullable()->after('small_price_cents');
      $table->unsignedInteger('large_price_cents')->nullable()->after('medium_price_cents');
    });
    DB::table('products')
      ->orderBy('id')
      ->each(function ($product) {
        DB::table('products')
          ->where('id', $product->id)
          ->update([
            'small_price_cents' => $product->price_cents,
            'medium_price_cents' => $product->price_cents,
            'large_price_cents' => $product->price_cents,
          ]);
      });
  }
  public function down(): void
  {
    Schema::table('products', function (Blueprint $table) {
      $table->dropColumn(['small_price_cents', 'medium_price_cents', 'large_price_cents']);
    });
  }
};
