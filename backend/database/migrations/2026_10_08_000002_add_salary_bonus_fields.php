<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
  public function up(): void
  {
    Schema::table('employee_salary_payments', function (Blueprint $table) {
      $table->unsignedBigInteger('salary_cents')->default(0)->after('month');
      $table->unsignedBigInteger('bonus_cents')->default(0)->after('salary_cents');
      $table->unsignedBigInteger('extra_bonus_cents')->default(0)->after('bonus_cents');
    });
    DB::table('employee_salary_payments')->update(['salary_cents' => DB::raw('amount_cents')]);
  }
  public function down(): void
  {
    Schema::table('employee_salary_payments', function (Blueprint $table) {
      $table->dropColumn(['salary_cents', 'bonus_cents', 'extra_bonus_cents']);
    });
  }
};
