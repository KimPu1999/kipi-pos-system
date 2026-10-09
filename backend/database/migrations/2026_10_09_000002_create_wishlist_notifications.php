<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  public function up(): void
  {
    Schema::create('wishlist_notifications', function (Blueprint $table) {
      $table->id();
      $table->foreignId('user_id')->constrained()->cascadeOnDelete();
      $table->foreignId('product_id')->constrained()->cascadeOnDelete();
      $table->string('type')->default('back_in_stock');
      $table->unsignedInteger('customer_count')->default(0);
      $table->timestamp('read_at')->nullable();
      $table->timestamps();
      $table->index(['user_id', 'read_at']);
    });
  }
  public function down(): void
  {
    Schema::dropIfExists('wishlist_notifications');
  }
};