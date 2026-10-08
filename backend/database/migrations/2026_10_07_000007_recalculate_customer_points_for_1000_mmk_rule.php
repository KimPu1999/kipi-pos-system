<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
return new class extends Migration {
  public function up(): void
  {
    DB::table('customer_points')
      ->orderBy('id')
      ->chunkById(200, function ($rows) {
        foreach ($rows as $row) {
          $total = DB::table('sales')->where('id', $row->sale_id)->value('total_cents');
          if ($total !== null) {
            DB::table('customer_points')
              ->where('id', $row->id)
              ->update(['points' => intdiv((int) $total, 100000)]);
          }
        }
      });
  }
  public function down(): void {}
};
