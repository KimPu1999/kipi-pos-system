<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
  public function up(): void
  {
    Schema::create('products', function (Blueprint $t) {
      $t->id();
      $t->string('name');
      $t->string('sku')->unique();
      $t->string('category');
      $t->unsignedInteger('price_cents');
      $t->unsignedInteger('stock');
      $t->string('emoji')->default('📦');
      $t->timestamps();
    });
    Schema::create('sales', function (Blueprint $t) {
      $t->id();
      $t->unsignedBigInteger('total_cents');
      $t->string('payment_method');
      $t->timestamps();
    });
    Schema::create('sale_items', function (Blueprint $t) {
      $t->id();
      $t->foreignId('sale_id')->constrained()->cascadeOnDelete();
      $t->foreignId('product_id')->constrained();
      $t->string('name');
      $t->unsignedInteger('price_cents');
      $t->unsignedInteger('quantity');
    });
  }
  public function down(): void
  {
    Schema::dropIfExists('sale_items');
    Schema::dropIfExists('sales');
    Schema::dropIfExists('products');
  }
};
