<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
  public function up(): void
  {
    Schema::table('orders', fn(Blueprint $t) => $t->string('payment_choice')->default('cash'));
  }
  public function down(): void
  {
    Schema::table('orders', fn(Blueprint $t) => $t->dropColumn('payment_choice'));
  }
};
