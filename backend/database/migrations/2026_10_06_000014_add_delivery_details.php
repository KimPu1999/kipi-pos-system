<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
  public function up(): void
  {
    Schema::table('orders', function (Blueprint $t) {
      $t->string('driver_name', 100)->nullable();
      $t->string('driver_phone', 40)->nullable();
      $t->string('delivery_location', 500)->nullable();
      $t->timestamp('delivery_eta')->nullable();
      $t->string('delivery_status')->nullable();
      $t->timestamp('dispatched_at')->nullable();
      $t->timestamp('delivered_at')->nullable();
    });
  }
  public function down(): void
  {
    Schema::table(
      'orders',
      fn(Blueprint $t) => $t->dropColumn([
        'driver_name',
        'driver_phone',
        'delivery_location',
        'delivery_eta',
        'delivery_status',
        'dispatched_at',
        'delivered_at',
      ]),
    );
  }
};
