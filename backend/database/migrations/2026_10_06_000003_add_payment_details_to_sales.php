<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
  public function up(): void
  {
    Schema::table('sales', function (Blueprint $table) {
      $table->unsignedBigInteger('amount_received_cents')->nullable();
      $table->unsignedBigInteger('change_cents')->default(0);
    });
  }
  public function down(): void
  {
    Schema::table(
      'sales',
      fn(Blueprint $table) => $table->dropColumn(['amount_received_cents', 'change_cents']),
    );
  }
};
