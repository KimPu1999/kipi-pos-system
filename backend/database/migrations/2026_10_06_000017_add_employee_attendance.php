<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
  public function up(): void
  {
    Schema::table('employees', function (Blueprint $t) {
      $t->dateTime('checked_in_at')->nullable();
    });
  }
  public function down(): void
  {
    Schema::table('employees', function (Blueprint $t) {
      $t->dropColumn('checked_in_at');
    });
  }
};
