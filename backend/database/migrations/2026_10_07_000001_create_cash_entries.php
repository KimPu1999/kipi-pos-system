<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
  public function up(): void
  {
    Schema::create('cash_entries', function (Blueprint $t) {
      $t->id();
      $t->foreignId('user_id')->constrained()->cascadeOnDelete();
      $t->string('type', 10);
      $t->unsignedBigInteger('amount_cents');
      $t->string('category', 100);
      $t->string('reference', 150)->nullable();
      $t->date('entry_date');
      $t->text('note')->nullable();
      $t->timestamps();
      $t->index(['entry_date', 'id']);
    });
  }
  public function down(): void
  {
    Schema::dropIfExists('cash_entries');
  }
};
