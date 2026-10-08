<?php
namespace App\Http\Controllers;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
class ReportController
{
  public function index(Request $r)
  {
    $d = $r->validate([
      'period' => 'required|in:day,month,year',
      'date' => 'required|date_format:Y-m-d',
    ]);
    $timezone = 'Asia/Yangon';
    $start = Carbon::parse($d['date'], $timezone)->startOfDay();
    if ($d['period'] === 'month') {
      $start->startOfMonth();
    }
    if ($d['period'] === 'year') {
      $start->startOfYear();
    }
    $end = $start->copy();
    match ($d['period']) {
      'day' => $end->addDay(),
      'month' => $end->addMonth(),
      'year' => $end->addYear(),
    };
    $sales = DB::table('sales')
      ->where('created_at', '>=', $start->copy()->utc()->format('Y-m-d H:i:s'))
      ->where('created_at', '<', $end->copy()->utc()->format('Y-m-d H:i:s'))
      ->get();
    $lines = DB::table('sale_items')->whereIn('sale_id', $sales->pluck('id'))->get();
    $products = DB::table('products')->orderBy('name')->get();
    $items = $lines
      ->groupBy('product_id')
      ->map(function ($group, $id) use ($products) {
        $p = $products->firstWhere('id', (int) $id);
        return [
          'product_id' => (int) $id,
          'name' => $p->name ?? $group->first()->name,
          'quantity' => (int) $group->sum('quantity'),
          'gross_cents' => (int) $group->sum(fn($i) => $i->quantity * $i->price_cents),
        ];
      })
      ->sortByDesc('quantity')
      ->values();
    $format = match ($d['period']) {
      'day' => 'H:00',
      'month' => 'Y-m-d',
      'year' => 'Y-m',
    };
    $grouped = $sales->groupBy(
      fn($s) => Carbon::parse($s->created_at, 'UTC')->setTimezone($timezone)->format($format),
    );
    $buckets = [];
    $cursor = $start->copy();
    while ($cursor->lt($end)) {
      $key = $cursor->format($format);
      $g = $grouped->get($key, collect());
      $buckets[] = [
        'label' => $key,
        'sales_count' => $g->count(),
        'net_cents' => (int) $g->sum('total_cents'),
      ];
      match ($d['period']) {
        'day' => $cursor->addHour(),
        'month' => $cursor->addDay(),
        'year' => $cursor->addMonth(),
      };
    }
    $reserved = DB::table('order_items')
      ->join('orders', 'orders.id', '=', 'order_items.order_id')
      ->whereIn('orders.status', ['pending', 'confirmed', 'ready'])
      ->select('product_id', DB::raw('SUM(quantity) as reserved'))
      ->groupBy('product_id')
      ->pluck('reserved', 'product_id');
    $inventory = $products->map(
      fn($p) => [
        'id' => $p->id,
        'name' => $p->name,
        'sku' => $p->sku,
        'active' => (bool) $p->active,
        'available' => $p->stock,
        'reserved' => (int) ($reserved[$p->id] ?? 0),
        'price_cents' => $p->price_cents,
        'available_value_cents' => $p->stock * $p->price_cents,
      ],
    );
    return response()->json([
      'period' => $d['period'],
      'timezone' => $timezone,
      'start' => $start->toIso8601String(),
      'end' => $end->toIso8601String(),
      'summary' => [
        'net_cents' => (int) $sales->sum('total_cents'),
        'gross_cents' => (int) $lines->sum(fn($i) => $i->quantity * $i->price_cents),
        'discount_cents' => (int) $sales->sum('discount_cents'),
        'tax_cents' => (int) $sales->sum('tax_cents'),
        'sales_count' => $sales->count(),
        'quantity' => (int) $lines->sum('quantity'),
      ],
      'items' => $items,
      'buckets' => $buckets,
      'inventory' => $inventory,
      'inventory_summary' => [
        'available_units' => (int) $inventory->sum('available'),
        'reserved_units' => (int) $inventory->sum('reserved'),
        'value_cents' => (int) $inventory->sum('available_value_cents'),
      ],
    ]);
  }
}
