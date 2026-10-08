<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
  public function up(): void
  {
    Schema::create('promotions', function (Blueprint $t) {
      $t->id();
      $t->string('code', 40)->unique();
      $t->string('name', 100);
      $t->unsignedInteger('percent');
      $t->boolean('active')->default(true);
      $t->date('expires_on')->nullable();
      $t->timestamps();
    });
    foreach (['orders', 'sales'] as $table) {
      Schema::table($table, function (Blueprint $t) {
        $t->unsignedBigInteger('subtotal_cents')->nullable();
        $t->unsignedBigInteger('discount_cents')->default(0);
        $t->string('promotion_code', 40)->nullable();
      });
    }
  }
  public function down(): void
  {
    foreach (['orders', 'sales'] as $table) {
      Schema::table(
        $table,
        fn(Blueprint $t) => $t->dropColumn(['subtotal_cents', 'discount_cents', 'promotion_code']),
      );
    }
    Schema::dropIfExists('promotions');
  }
};
