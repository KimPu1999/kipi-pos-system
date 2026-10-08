<?php
namespace App\Http\Controllers;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
class PurchaseController
{
  private function present(int $id): object
  {
    $purchase = DB::table('purchases')->find($id);
    $purchase->items = DB::table('purchase_items')->where('purchase_id', $id)->get();
    return $purchase;
  }
  public function index()
  {
    return response()->json(
      DB::table('purchases')->orderByDesc('id')->get()->map(fn($p) => $this->present($p->id)),
    );
  }
  public function update(Request $r, int $id)
  {
    $d = $r->validate([
      'supplier' => 'required|string|max:150',
      'reference' => 'nullable|string|max:150',
      'purchased_on' => 'required|date_format:Y-m-d',
      'note' => 'nullable|string|max:2000',
      'items' => 'required|array|min:1|max:100',
      'items.*.id' => 'required|integer|distinct',
      'items.*.unit_cost_cents' => 'required|integer|min:0|max:100000000',
    ]);
    DB::transaction(function () use ($id, $d) {
      $p = DB::table('purchases')->where('id', $id)->lockForUpdate()->first();
      abort_unless($p, 404);
      $items = DB::table('purchase_items')->where('purchase_id', $id)->get()->keyBy('id');
      if (count($d['items']) !== $items->count()) {
        throw ValidationException::withMessages([
          'items' => 'Include all original purchase items.',
        ]);
      }
      $total = 0;
      foreach ($d['items'] as $line) {
        if (!$items->has($line['id'])) {
          throw ValidationException::withMessages(['items' => 'Invalid purchase item.']);
        }
        $total += $items[$line['id']]->quantity * $line['unit_cost_cents'];
        DB::table('purchase_items')
          ->where('id', $line['id'])
          ->update(['unit_cost_cents' => $line['unit_cost_cents']]);
      }
      unset($d['items']);
      DB::table('purchases')
        ->where('id', $id)
        ->update([...$d, 'total_cents' => $total, 'updated_at' => now()]);
      if ($p->payment_status === 'paid') {
        DB::table('cash_entries')
          ->where('source_type', 'purchase')
          ->where('source_id', $id)
          ->update([
            'amount_cents' => $total,
            'reference' => $d['reference'] ?? $p->reference ?: 'Purchase #' . $id,
            'note' =>
              'Automatic cash out · ' .
              str_replace('_', ' ', $p->payment_method) .
              ' · ' .
              $d['supplier'],
            'updated_at' => now(),
          ]);
      }
    });
    return response()->json($this->present($id));
  }
  public function pay(Request $r, int $id)
  {
    $d = $r->validate(['payment_method' => 'required|in:cash,bank_transfer,card']);
    DB::transaction(function () use ($id, $d, $r) {
      $p = DB::table('purchases')->where('id', $id)->lockForUpdate()->first();
      abort_unless($p, 404);
      abort_unless($p->payment_status === 'pending', 409, 'Purchase is already paid.');
      $now = now();
      DB::table('purchases')
        ->where('id', $id)
        ->update([...$d, 'payment_status' => 'paid', 'paid_at' => $now, 'updated_at' => $now]);
      DB::table('cash_entries')->insert([
        'user_id' => $r->user()->id,
        'type' => 'out',
        'payment_status' => 'paid',
        'paid_at' => $now,
        'amount_cents' => $p->total_cents,
        'category' => 'Purchase payment',
        'reference' => $p->reference ?: 'Purchase #' . $p->id,
        'entry_date' => $now->timezone('Asia/Yangon')->format('Y-m-d'),
        'note' =>
          'Automatic cash out · ' .
          str_replace('_', ' ', $d['payment_method']) .
          ' · ' .
          $p->supplier,
        'source_type' => 'purchase',
        'source_id' => $p->id,
        'created_at' => $now,
        'updated_at' => $now,
      ]);
    });
    return response()->json($this->present($id));
  }
  public function store(Request $request)
  {
    $data = $request->validate([
      'supplier' => 'required|string|max:150',
      'reference' => 'nullable|string|max:150',
      'purchased_on' => 'required|date_format:Y-m-d',
      'note' => 'nullable|string|max:2000',
      'request_id' => 'required|uuid',
      'items' => 'required|array|min:1|max:100',
      'items.*.product_id' => 'required|integer|distinct|exists:products,id',
      'items.*.quantity' => 'required|integer|min:1|max:100000',
      'items.*.unit_cost_cents' => 'required|integer|min:0|max:100000000',
    ]);
    $id = DB::transaction(function () use ($data, $request) {
      $existing = DB::table('purchases')->where('request_id', $data['request_id'])->first();
      if ($existing) {
        return $existing->id;
      }
      $lines = collect($data['items'])->sortBy('product_id');
      $products = DB::table('products')
        ->whereIn('id', $lines->pluck('product_id'))
        ->orderBy('id')
        ->lockForUpdate()
        ->get()
        ->keyBy('id');
      $total = 0;
      foreach ($lines as $line) {
        $product = $products->get($line['product_id']);
        if (!$product || $product->stock + $line['quantity'] > 1000000000) {
          throw ValidationException::withMessages([
            'items' => 'The resulting stock is too large or a product is missing.',
          ]);
        }
        $total += $line['quantity'] * $line['unit_cost_cents'];
      }
      $now = now();
      $id = DB::table('purchases')->insertGetId([
        'user_id' => $request->user()->id,
        'supplier' => $data['supplier'],
        'reference' => $data['reference'] ?? null,
        'purchased_on' => $data['purchased_on'],
        'note' => $data['note'] ?? null,
        'request_id' => $data['request_id'],
        'total_cents' => $total,
        'created_at' => $now,
        'updated_at' => $now,
      ]);
      foreach ($lines as $line) {
        DB::table('purchase_items')->insert([
          'purchase_id' => $id,
          'product_id' => $line['product_id'],
          'name' => $products[$line['product_id']]->name,
          'quantity' => $line['quantity'],
          'unit_cost_cents' => $line['unit_cost_cents'],
        ]);
        DB::table('products')
          ->where('id', $line['product_id'])
          ->increment('stock', $line['quantity'], ['updated_at' => $now]);
      }
      return $id;
    });
    return response()->json($this->present($id), 201);
  }
}
