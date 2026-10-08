<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
  public function up(): void
  {
    Schema::create('announcements', function (Blueprint $t) {
      $t->id();
      $t->foreignId('user_id')->constrained()->cascadeOnDelete();
      $t->string('title', 150);
      $t->text('message');
      $t->boolean('active')->default(true);
      $t->timestamps();
    });
    Schema::create('announcement_reads', function (Blueprint $t) {
      $t->foreignId('announcement_id')->constrained()->cascadeOnDelete();
      $t->foreignId('user_id')->constrained()->cascadeOnDelete();
      $t->timestamp('read_at');
      $t->primary(['announcement_id', 'user_id']);
    });
  }
  public function down(): void
  {
    Schema::dropIfExists('announcement_reads');
    Schema::dropIfExists('announcements');
  }
};
