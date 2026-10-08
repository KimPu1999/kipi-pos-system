<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
  public function up(): void
  {
    Schema::table('orders', function (Blueprint $t) {
      $t->string('transfer_name', 100)->nullable();
      $t->string('transfer_phone', 40)->nullable();
    });
  }
  public function down(): void
  {
    Schema::table(
      'orders',
      fn(Blueprint $t) => $t->dropColumn(['transfer_name', 'transfer_phone']),
    );
  }
};
