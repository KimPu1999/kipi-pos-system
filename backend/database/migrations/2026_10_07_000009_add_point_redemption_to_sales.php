<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
  public function up(): void
  {
    Schema::table('sales', function (Blueprint $t) {
      $t->unsignedBigInteger('redeemed_points')->default(0);
      $t->unsignedBigInteger('point_discount_cents')->default(0);
    });
  }
  public function down(): void
  {
    Schema::table(
      'sales',
      fn(Blueprint $t) => $t->dropColumn(['redeemed_points', 'point_discount_cents']),
    );
  }
};
