<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
  public function up(): void
  {
    Schema::table('dining_tables', function (Blueprint $t) {
      $t->string('area', 100)->default('Ground floor');
    });
  }
  public function down(): void
  {
    Schema::table('dining_tables', function (Blueprint $t) {
      $t->dropColumn('area');
    });
  }
};
