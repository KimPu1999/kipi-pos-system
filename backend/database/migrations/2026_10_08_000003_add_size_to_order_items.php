<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
  public function up(): void
  {
    Schema::table('order_items', function (Blueprint $table) {
      $table->string('size', 10)->default('medium')->after('quantity');
    });
    Schema::table('sale_items', function (Blueprint $table) {
      $table->string('size', 10)->default('medium')->after('quantity');
    });
  }
  public function down(): void
  {
    Schema::table('order_items', fn(Blueprint $table) => $table->dropColumn('size'));
    Schema::table('sale_items', fn(Blueprint $table) => $table->dropColumn('size'));
  }
};
