<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
  public function up(): void
  {
    Schema::table('orders', fn(Blueprint $t) => $t->timestamp('customer_confirmed_at')->nullable());
  }
  public function down(): void
  {
    Schema::table('orders', fn(Blueprint $t) => $t->dropColumn('customer_confirmed_at'));
  }
};
