<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
  public function up(): void
  {
    Schema::table('orders', function (Blueprint $t) {
      $t->timestamp('confirmed_at')->nullable();
      $t->timestamp('ready_at')->nullable();
      $t->timestamp('completed_at')->nullable();
      $t->timestamp('cancelled_at')->nullable();
    });
  }
  public function down(): void
  {
    Schema::table(
      'orders',
      fn(Blueprint $t) => $t->dropColumn([
        'confirmed_at',
        'ready_at',
        'completed_at',
        'cancelled_at',
      ]),
    );
  }
};
