<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
  public function up(): void
  {
    Schema::table('notes', function (Blueprint $t) {
      $t->string('file_name')->nullable();
      $t->string('file_path')->nullable();
      $t->string('file_mime', 120)->nullable();
      $t->unsignedBigInteger('file_size')->nullable();
    });
  }
  public function down(): void
  {
    Schema::table('notes', function (Blueprint $t) {
      $t->dropColumn(['file_name', 'file_path', 'file_mime', 'file_size']);
    });
  }
};
