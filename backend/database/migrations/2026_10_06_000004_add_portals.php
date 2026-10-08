<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
return new class extends Migration {
  public function up(): void
  {
    Schema::table('users', fn(Blueprint $t) => $t->string('role')->default('customer'));
    // Preserve access for existing operators. New public registrations are customers.
    DB::table('users')->update(['role' => 'admin']);
    Schema::table('products', fn(Blueprint $t) => $t->boolean('active')->default(true));
    Schema::create('orders', function (Blueprint $t) {
      $t->id();
      $t->foreignId('user_id')->constrained();
      $t->string('status')->default('pending');
      $t->unsignedBigInteger('total_cents');
      $t->text('note')->nullable();
      $t->foreignId('sale_id')->nullable()->constrained();
      $t->timestamps();
    });
    Schema::create('order_items', function (Blueprint $t) {
      $t->id();
      $t->foreignId('order_id')->constrained()->cascadeOnDelete();
      $t->foreignId('product_id')->constrained();
      $t->string('name');
      $t->unsignedInteger('price_cents');
      $t->unsignedInteger('quantity');
    });
  }
  public function down(): void
  {
    Schema::dropIfExists('order_items');
    Schema::dropIfExists('orders');
    Schema::table('products', fn(Blueprint $t) => $t->dropColumn('active'));
    Schema::table('users', fn(Blueprint $t) => $t->dropColumn('role'));
  }
};
