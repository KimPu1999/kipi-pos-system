<?php
namespace App\Http\Controllers;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
class CustomerRewardsController
{
  public function index(Request $r)
  {
    $id = $r->user()->id;
    if ($r->filled('customer_id')) {
      abort_unless($r->user()->role === 'admin', 403);
      $r->validate(['customer_id' => 'integer|exists:users,id']);
      $id = (int) $r->input('customer_id');
    }
    $ledger = DB::table('customer_points')->where('user_id', $id)->get();
    $history = DB::table('sales')
      ->join('customer_points', 'customer_points.sale_id', '=', 'sales.id')
      ->where('customer_points.user_id', $id)
      ->select('sales.*', 'customer_points.points')
      ->orderByDesc('sales.id')
      ->limit(200)
      ->get()
      ->map(function ($s) {
        $s->created_at = \Illuminate\Support\Carbon::parse(
          $s->created_at,
          'UTC',
        )->toIso8601String();
        $s->items = DB::table('sale_items')->where('sale_id', $s->id)->get();
        return $s;
      });
    return response()->json([
      'points' => max(
        0,
        (int) $ledger->sum('points') -
          (int) DB::table('sales')
            ->whereIn('id', $ledger->pluck('sale_id'))
            ->sum('redeemed_points'),
      ),
      'purchases_count' => $ledger->count(),
      'spent_cents' => DB::table('sales')
        ->whereIn('id', $ledger->pluck('sale_id'))
        ->sum('total_cents'),
      'history' => $history,
      'rule' =>
        'Earn 1 point for every whole 1,000 MMK spent after discounts. Redeem 1 point for 1 MMK.',
    ]);
  }
}
