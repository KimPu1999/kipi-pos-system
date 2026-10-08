<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
  public function up(): void
  {
    Schema::create('purchases', function (Blueprint $t) {
      $t->id();
      $t->foreignId('user_id')->constrained();
      $t->string('supplier');
      $t->string('reference')->nullable();
      $t->date('purchased_on');
      $t->text('note')->nullable();
      $t->uuid('request_id')->unique();
      $t->unsignedBigInteger('total_cents');
      $t->timestamps();
    });
    Schema::create('purchase_items', function (Blueprint $t) {
      $t->id();
      $t->foreignId('purchase_id')->constrained()->cascadeOnDelete();
      $t->foreignId('product_id')->constrained();
      $t->string('name');
      $t->unsignedInteger('quantity');
      $t->unsignedInteger('unit_cost_cents');
    });
  }
  public function down(): void
  {
    Schema::dropIfExists('purchase_items');
    Schema::dropIfExists('purchases');
  }
};
