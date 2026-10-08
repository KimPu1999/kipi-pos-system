<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
  public function up(): void
  {
    Schema::table('orders', function (Blueprint $t) {
      $t->unsignedBigInteger('dining_table_id')->nullable();
      $t->string('table_name')->nullable();
    });
  }
  public function down(): void
  {
    Schema::table('orders', function (Blueprint $t) {
      $t->dropColumn(['dining_table_id', 'table_name']);
    });
  }
};
