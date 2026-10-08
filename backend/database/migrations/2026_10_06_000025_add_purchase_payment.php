<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
  public function up(): void
  {
    Schema::table('purchases', function (Blueprint $t) {
      $t->string('payment_status')->default('pending');
      $t->string('payment_method')->nullable();
      $t->timestamp('paid_at')->nullable();
    });
  }
  public function down(): void
  {
    Schema::table('purchases', function (Blueprint $t) {
      $t->dropColumn(['payment_status', 'payment_method', 'paid_at']);
    });
  }
};
