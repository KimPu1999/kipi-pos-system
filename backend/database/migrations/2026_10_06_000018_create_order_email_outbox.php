<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
  public function up(): void
  {
    Schema::create('order_emails', function (Blueprint $t) {
      $t->id();
      $t->foreignId('order_id')->constrained();
      $t->string('recipient');
      $t->string('subject');
      $t->text('body');
      $t->unsignedInteger('attempts')->default(0);
      $t->timestamp('sent_at')->nullable();
      $t->timestamps();
    });
  }
  public function down(): void
  {
    Schema::dropIfExists('order_emails');
  }
};
