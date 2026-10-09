<?php
namespace App\Http\Controllers;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
class PosController
{
  public function products()
  {
    return response()->json(DB::table('products')->orderBy('id')->get());
  }
  public function storeProduct(Request $r)
  {
    $data = $r->validate([
      'name' => 'required|string|max:100',
      'sku' => 'nullable|string|max:100|unique:products,sku',
      'category' => 'required|string|max:60',
      'price_cents' => 'nullable|integer|min:0|max:100000000',
      'small_price_cents' => 'nullable|integer|min:0|max:100000000',
      'medium_price_cents' => 'nullable|integer|min:0|max:100000000',
      'large_price_cents' => 'nullable|integer|min:0|max:100000000',
      'stock' => 'required|integer|min:0|max:1000000',
      'emoji' => 'sometimes|string|max:10',
      'active' => 'sometimes|boolean',
      'image' => 'nullable|image|mimes:jpg,jpeg,png,webp|max:2048',
    ]);
    if (empty($data['sku'])) {
      $data['sku'] =
        'PRD-' . strtoupper(str_replace('-', '', (string) \Illuminate\Support\Str::uuid()));
    }
    $sizePriceFields = ['small_price_cents', 'medium_price_cents', 'large_price_cents'];
    $hasSizePrices = collect($sizePriceFields)->contains(
      fn($field) => array_key_exists($field, $data),
    );
    if (!$hasSizePrices && isset($data['price_cents'])) {
      foreach ($sizePriceFields as $field) {
        $data[$field] = $data['price_cents'];
      }
    }
    $data['price_cents'] =
      $data['medium_price_cents'] ??
      ($data['small_price_cents'] ??
        ($data['large_price_cents'] ?? ($data['price_cents'] ?? null)));
    if ($data['price_cents'] === null) {
      throw ValidationException::withMessages([
        'prices' => 'Enter a price for at least one size.',
      ]);
    }
    unset($data['image']);
    $path = $r->hasFile('image') ? $r->file('image')->store('products', 'local') : null;
    if ($path) {
      $data['image_path'] = $path;
    }
    try {
      $id = DB::table('products')->insertGetId([
        ...$data,
        'created_at' => now(),
        'updated_at' => now(),
      ]);
    } catch (\Throwable $e) {
      if ($path) {
        \Illuminate\Support\Facades\Storage::disk('local')->delete($path);
      }
      throw $e;
    }
    return response()->json(DB::table('products')->find($id), 201);
  }
  private function sale(int $id): object
  {
    $sale = DB::table('sales')->find($id);
    $order = DB::table('orders')
      ->where('sale_id', $id)
      ->first([
        'id',
        'transfer_provider',
        'driver_name',
        'driver_phone',
        'delivery_location',
        'delivery_eta',
        'delivered_at',
      ]);
    $sale->order_id = $order?->id;
    $sale->transfer_provider = $order?->transfer_provider;
    $sale->driver_name = $order?->driver_name;
    $sale->driver_phone = $order?->driver_phone;
    $sale->delivery_location = $order?->delivery_location;
    $sale->delivery_eta = $order?->delivery_eta;
    $sale->delivered_at = $order?->delivered_at;
    $sale->items = DB::table('sale_items')->where('sale_id', $id)->get();
    return $sale;
  }
  public function sales()
  {
    return response()->json(
      DB::table('sales')->orderByDesc('id')->get()->map(fn($s) => $this->sale($s->id)),
    );
  }
  public function checkout(Request $r)
  {
    $data = $r->validate([
      'cardholder_name' => 'nullable|string|max:100',
      'card_last_four' => 'nullable|regex:/^[0-9]{4}$/',
      'discount_percent' => 'sometimes|numeric|min:0|max:100',
      'discount_cents' => 'sometimes|integer|min:0|max:1000000000',
      'customer_id' => 'nullable|integer|exists:users,id',
      'contact' => 'sometimes|array:name,email,phone,location,zip_code',
      'contact.name' => 'required_with:contact|string|max:100',
      'contact.email' => 'required_with:contact|email|max:254',
      'contact.phone' => 'required_with:contact|string|max:40',
      'contact.location' => 'required_with:contact|string|max:500',
      'contact.zip_code' => 'required_with:contact|string|max:20',
      'service_type' => 'sometimes|in:dine_in,takeaway',
      'dining_table_id' => 'nullable|integer|exists:dining_tables,id',
      'payment_method' => 'required|in:cash,card',
      'amount_received_cents' => 'nullable|integer|min:0|max:1000000000',
      'items' => 'required|array|min:1|max:100',
      'items.*.product_id' => 'required|integer|distinct|exists:products,id',
      'items.*.quantity' => 'required|integer|min:1|max:10000',
      'items.*.size' => 'sometimes|in:small,medium,large',
    ]);
    $sale = DB::transaction(function () use ($data) {
      $service = $data['service_type'] ?? 'takeaway';
      $table = null;
      $customerId = $data['customer_id'] ?? null;
      if (
        $customerId &&
        !DB::table('users')->where('id', $customerId)->where('role', 'customer')->exists()
      ) {
        throw ValidationException::withMessages(['customer_id' => 'Choose a customer account.']);
      }
      if ($service === 'dine_in') {
        $table = DB::table('dining_tables')
          ->where('id', $data['dining_table_id'] ?? 0)
          ->lockForUpdate()
          ->first();
        if (!$table || $table->status !== 'available') {
          throw ValidationException::withMessages([
            'dining_table_id' => 'Choose an available table for dine-in.',
          ]);
        }
      }
      $items = collect($data['items'])->sortBy('product_id');
      $total = 0;
      $lines = [];
      foreach ($items as $item) {
        $p = DB::table('products')->where('id', $item['product_id'])->lockForUpdate()->first();
        if (!$p || !$p->active || $p->stock < $item['quantity']) {
          throw ValidationException::withMessages([
            'items' => 'Insufficient stock for ' . ($p->name ?? 'product'),
          ]);
        }
        // Conditional update prevents overselling even on databases without row locks.
        $updated = DB::table('products')
          ->where('id', $p->id)
          ->where('stock', '>=', $item['quantity'])
          ->decrement('stock', $item['quantity'], ['updated_at' => now()]);
        if (!$updated) {
          throw ValidationException::withMessages(['items' => 'Stock changed. Please try again.']);
        }
        $size = $item['size'] ?? 'medium';
        $priceField = $size . '_price_cents';
        $hasConfiguredSizes =
          $p->small_price_cents !== null ||
          $p->medium_price_cents !== null ||
          $p->large_price_cents !== null;
        if ($hasConfiguredSizes && $p->$priceField === null) {
          throw ValidationException::withMessages([
            'items' => ucfirst($size) . ' is not available for ' . $p->name . '.',
          ]);
        }
        $unitPrice = (int) ($p->$priceField ?? $p->price_cents);
        $total += $unitPrice * $item['quantity'];
        $lines[] = [
          'product_id' => $p->id,
          'name' => $p->name,
          'price_cents' => $unitPrice,
          'quantity' => $item['quantity'],
          'size' => $size,
        ];
      }
      $subtotal = $total;
      $discount = isset($data['discount_percent'])
        ? (int) round(($subtotal * $data['discount_percent']) / 100)
        : $data['discount_cents'] ?? 0;
      if ($discount > $subtotal) {
        throw ValidationException::withMessages([
          'discount_cents' => 'Discount cannot exceed the subtotal.',
        ]);
      }
      $taxSettings = json_decode(
        DB::table('system_settings')->where('id', 1)->value('settings') ?? '{}',
        true,
      );
      $taxPercent = max(0, min(100, (float) ($taxSettings['tax_percent'] ?? 0)));
      $tax = (int) round((($subtotal - $discount) * $taxPercent) / 100);
      $total = $subtotal - $discount + $tax;
      $received =
        $data['payment_method'] === 'cash' ? $data['amount_received_cents'] ?? $total : null;
      if ($received !== null && $received < $total) {
        throw ValidationException::withMessages([
          'amount_received_cents' => 'Cash received must cover the total.',
        ]);
      }
      $contact = $service === 'takeaway' ? $data['contact'] ?? [] : [];
      $id = DB::table('sales')->insertGetId([
        'tax_percent' => $taxPercent,
        'tax_cents' => $tax,
        'cardholder_name' =>
          $data['payment_method'] === 'card' ? $data['cardholder_name'] ?? null : null,
        'card_last_four' =>
          $data['payment_method'] === 'card' ? $data['card_last_four'] ?? null : null,
        'subtotal_cents' => $subtotal,
        'discount_cents' => $discount,
        'contact_name' => $contact['name'] ?? null,
        'contact_email' => $contact['email'] ?? null,
        'phone' => $contact['phone'] ?? null,
        'location' => $contact['location'] ?? null,
        'zip_code' => $contact['zip_code'] ?? null,
        'service_type' => $service,
        'dining_table_id' => $table?->id,
        'table_name' => $table?->name,
        'amount_received_cents' => $received,
        'change_cents' => $received === null ? 0 : $received - $total,
        'total_cents' => $total,
        'payment_method' => $data['payment_method'],
        'created_at' => now(),
        'updated_at' => now(),
      ]);
      if ($customerId) {
        DB::table('customer_points')->insert([
          'user_id' => $customerId,
          'sale_id' => $id,
          'points' => intdiv($total, 100000),
          'created_at' => now(),
        ]);
      }
      DB::table('sale_items')->insert(array_map(fn($line) => [...$line, 'sale_id' => $id], $lines));
      return $this->sale($id);
    }, 3);
    return response()->json($sale, 201);
  }
}
