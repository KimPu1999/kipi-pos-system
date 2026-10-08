<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
  public function up(): void
  {
    Schema::create('employees', function (Blueprint $t) {
      $t->id();
      $t->string('employee_code')->unique();
      $t->string('name');
      $t->unsignedBigInteger('salary_cents');
      $t->boolean('active')->default(true);
      $t->timestamps();
    });
    Schema::create('employee_shifts', function (Blueprint $t) {
      $t->id();
      $t->foreignId('employee_id')->constrained();
      $t->dateTime('starts_at');
      $t->dateTime('ends_at');
      $t->unsignedInteger('break_minutes')->default(0);
      $t->unsignedInteger('worked_minutes');
      $t->timestamps();
    });
  }
  public function down(): void
  {
    Schema::dropIfExists('employee_shifts');
    Schema::dropIfExists('employees');
  }
};
