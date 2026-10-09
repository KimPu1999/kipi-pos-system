<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
  public function up(): void
  {
    Schema::table('promotions', fn(Blueprint $t) => $t->json('categories')->nullable());
  }
  public function down(): void
  {
    Schema::table('promotions', fn(Blueprint $t) => $t->dropColumn('categories'));
  }
};