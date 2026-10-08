<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
  public function up(): void
  {
    Schema::table('notes', function (Blueprint $t) {
      $t->dropColumn(['emailed_to', 'emailed_at']);
    });
  }
  public function down(): void
  {
    Schema::table('notes', function (Blueprint $t) {
      $t->string('emailed_to')->nullable();
      $t->timestamp('emailed_at')->nullable();
    });
  }
};
