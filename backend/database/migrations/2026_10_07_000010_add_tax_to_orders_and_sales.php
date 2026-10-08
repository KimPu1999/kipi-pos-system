<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
  public function up(): void
  {
    Schema::table('orders', function (Blueprint $t) {
      $t->decimal('tax_percent', 5, 2)->default(0);
      $t->unsignedBigInteger('tax_cents')->default(0);
    });
    Schema::table('sales', function (Blueprint $t) {
      $t->decimal('tax_percent', 5, 2)->default(0);
      $t->unsignedBigInteger('tax_cents')->default(0);
    });
  }
  public function down(): void
  {
    Schema::table('orders', fn(Blueprint $t) => $t->dropColumn(['tax_percent', 'tax_cents']));
    Schema::table('sales', fn(Blueprint $t) => $t->dropColumn(['tax_percent', 'tax_cents']));
  }
};
