<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
  public function up(): void
  {
    Schema::table('cash_entries', function (Blueprint $t) {
      $t->string('payment_status', 20)->default('paid')->after('type');
      $t->timestamp('paid_at')->nullable()->after('entry_date');
      $t->index('payment_status');
    });
  }
  public function down(): void
  {
    Schema::table('cash_entries', function (Blueprint $t) {
      $t->dropIndex(['payment_status']);
      $t->dropColumn(['payment_status', 'paid_at']);
    });
  }
};
