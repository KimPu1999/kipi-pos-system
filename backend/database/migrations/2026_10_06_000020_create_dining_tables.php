<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
  public function up(): void
  {
    Schema::create('dining_tables', function (Blueprint $t) {
      $t->id();
      $t->string('name')->unique();
      $t->unsignedInteger('seats');
      $t->string('status')->default('available');
      $t->timestamps();
    });
  }
  public function down(): void
  {
    Schema::dropIfExists('dining_tables');
  }
};
