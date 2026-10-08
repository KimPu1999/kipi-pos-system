<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
  public function up(): void
  {
    Schema::table('sales', function (Blueprint $t) {
      $t->string('cardholder_name', 100)->nullable();
      $t->string('card_last_four', 4)->nullable();
    });
  }
  public function down(): void
  {
    Schema::table(
      'sales',
      fn(Blueprint $t) => $t->dropColumn(['cardholder_name', 'card_last_four']),
    );
  }
};
