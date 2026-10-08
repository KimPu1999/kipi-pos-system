<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
  public function up(): void
  {
    Schema::create('notes', function (Blueprint $t) {
      $t->id();
      $t->foreignId('user_id')->constrained()->cascadeOnDelete();
      $t->string('title', 150);
      $t->string('category', 60)->default('General');
      $t->text('content');
      $t->boolean('pinned')->default(false);
      $t->timestamps();
    });
  }
  public function down(): void
  {
    Schema::dropIfExists('notes');
  }
};
