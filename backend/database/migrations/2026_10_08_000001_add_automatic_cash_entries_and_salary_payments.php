<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
  public function up(): void
  {
    Schema::table('cash_entries', function (Blueprint $table) {
      $table->string('source_type', 40)->nullable()->after('note');
      $table->unsignedBigInteger('source_id')->nullable()->after('source_type');
      $table->unique(['source_type', 'source_id']);
    });
    Schema::create('employee_salary_payments', function (Blueprint $table) {
      $table->id();
      $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
      $table->foreignId('user_id')->constrained()->restrictOnDelete();
      $table->string('month', 7);
      $table->unsignedBigInteger('amount_cents');
      $table->string('payment_method', 30);
      $table->date('paid_on');
      $table->text('note')->nullable();
      $table
        ->foreignId('cash_entry_id')
        ->nullable()
        ->unique()
        ->constrained('cash_entries')
        ->restrictOnDelete();
      $table->timestamps();
      $table->unique(['employee_id', 'month']);
    });
  }
  public function down(): void
  {
    Schema::dropIfExists('employee_salary_payments');
    Schema::table('cash_entries', function (Blueprint $table) {
      $table->dropUnique(['source_type', 'source_id']);
      $table->dropColumn(['source_type', 'source_id']);
    });
  }
};
