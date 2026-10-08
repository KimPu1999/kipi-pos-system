<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
return new class extends Migration {
  public function up(): void
  {
    Schema::create('customer_points', function (Blueprint $t) {
      $t->id();
      $t->foreignId('user_id')->constrained();
      $t->foreignId('sale_id')->unique()->constrained();
      $t->unsignedBigInteger('points');
      $t->timestamp('created_at');
    });
    DB::table('orders')
      ->where('status', 'completed')
      ->whereNotNull('sale_id')
      ->orderBy('id')
      ->chunk(200, function ($orders) {
        foreach ($orders as $o) {
          $sale = DB::table('sales')->find($o->sale_id);
          if ($sale) {
            DB::table('customer_points')->insertOrIgnore([
              'user_id' => $o->user_id,
              'sale_id' => $sale->id,
              'points' => intdiv($sale->total_cents, 100000),
              'created_at' => $sale->created_at,
            ]);
          }
        }
      });
  }
  public function down(): void
  {
    Schema::dropIfExists('customer_points');
  }
};
