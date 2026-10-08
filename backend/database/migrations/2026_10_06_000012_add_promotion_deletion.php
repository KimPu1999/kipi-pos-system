<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
  public function up(): void
  {
    Schema::table('promotions', fn(Blueprint $t) => $t->timestamp('deleted_at')->nullable());
  }
  public function down(): void
  {
    Schema::table('promotions', fn(Blueprint $t) => $t->dropColumn('deleted_at'));
  }
};
