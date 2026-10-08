<?php
namespace App\Http\Controllers;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
class PortalController
{
  private function taxPercent(): float
  {
    $settings = json_decode(
      DB::table('system_settings')->where('id', 1)->value('settings') ?? '{}',
      true,
    );
    return max(0, min(100, (float) ($settings['tax_percent'] ?? 0)));
  }
  private function contactData(array $c): array
  {
    $map = [
      'name' => 'contact_name',
      'email' => 'contact_email',
      'phone' => 'phone',
      'location' => 'location',
      'zip_code' => 'zip_code',
    ];
    $out = [];
    foreach ($map as $key => $column) {
      if (isset($c[$key])) {
        $out[$column] = trim($c[$key]);
      }
    }
    return $out;
  }
  private function tableData(array $data): array
  {
    if (($data['service_type'] ?? 'takeaway') !== 'dine_in' || empty($data['dining_table_id'])) {
      return ['dining_table_id' => null, 'table_name' => null];
    }
    $table = DB::table('dining_tables')
      ->where('id', $data['dining_table_id'])
      ->lockForUpdate()
      ->first();
    if (!$table || $table->status !== 'available') {
      throw ValidationException::withMessages([
        'dining_table_id' => 'This table is unavailable. Choose another table.',
      ]);
    }
    return ['dining_table_id' => $table->id, 'table_name' => $table->name];
  }
  public function catalog()
  {
    return response()->json(DB::table('products')->where('active', true)->orderBy('name')->get());
  }
  private function order(int $id): object
  {
    $o = DB::table('orders')
      ->join('users', 'users.id', '=', 'orders.user_id')
      ->select('orders.*', 'users.name as customer_name', 'users.email as customer_email')
      ->where('orders.id', $id)
      ->first();
    foreach (
      [
        'created_at',
        'updated_at',
        'customer_confirmed_at',
        'confirmed_at',
        'ready_at',
        'completed_at',
        'cancelled_at',
        'delivery_eta',
        'dispatched_at',
        'delivered_at',
      ]
      as $field
    ) {
      if ($o->$field) {
        $o->$field = \Illuminate\Support\Carbon::parse($o->$field, 'UTC')->toIso8601String();
      }
    }
    $o->customer_name = $o->contact_name ?? $o->customer_name;
    $o->customer_email = $o->contact_email ?? $o->customer_email;
    $o->payment = $o->sale_id
      ? DB::table('sales')
        ->where('id', $o->sale_id)
        ->select(
          'payment_method',
          'amount_received_cents',
          'change_cents',
          'cardholder_name',
          'card_last_four',
        )
        ->first()
      : null;
    $o->items = DB::table('order_items')->where('order_id', $id)->get();
    return $o;
  }
  private function notifyOrder(int $id, string $event): object
  {
    $o = $this->order($id);
    \App\Services\OrderEmails::record($o, $event);
    return $o;
  }
  public function orders(Request $r)
  {
    $q = DB::table('orders')->orderByDesc('id');
    if ($r->user()->role !== 'admin') {
      $q->where('user_id', $r->user()->id);
    }
    return response()->json($q->get()->map(fn($o) => $this->order($o->id)));
  }
  public function placeOrder(Request $r)
  {
    $d = $r->validate([
      'transfer_provider' => 'sometimes|nullable|in:kbzpay,ayapay',
      'payment_choice' => 'sometimes|in:cash,card,transfer',
      'transfer_name' => 'nullable|string|max:100',
      'transfer_phone' => 'nullable|string|max:40',
      'dining_table_id' => 'nullable|integer|exists:dining_tables,id',
      'promotion_code' => 'nullable|string|max:40',
      'service_type' => 'sometimes|in:dine_in,takeaway',
      'contact' => 'sometimes|array:name,email,phone,location,zip_code',
      'contact.name' => 'required_with:contact|string|max:100',
      'contact.email' => 'required_with:contact|email|max:254',
      'contact.phone' => 'required_with:contact|string|max:40',
      'contact.location' => 'required_with:contact|string|max:500',
      'contact.zip_code' => 'required_with:contact|string|max:20',
      'note' => 'nullable|string|max:500',
      'items' => 'required|array|min:1|max:100',
      'items.*.product_id' => 'required|integer|distinct|exists:products,id',
      'items.*.quantity' => 'required|integer|min:1|max:10000',
    ]);
    $o = DB::transaction(function () use ($d, $r) {
      $total = 0;
      $lines = [];
      foreach (collect($d['items'])->sortBy('product_id') as $i) {
        $p = DB::table('products')->where('id', $i['product_id'])->lockForUpdate()->first();
        if (!$p || !$p->active || $p->stock < $i['quantity']) {
          throw ValidationException::withMessages([
            'items' => 'An item is unavailable or has insufficient stock.',
          ]);
        }
        if (
          !DB::table('products')
            ->where('id', $p->id)
            ->where('stock', '>=', $i['quantity'])
            ->decrement('stock', $i['quantity'])
        ) {
          throw ValidationException::withMessages(['items' => 'Stock changed. Please retry.']);
        }
        $total += $p->price_cents * $i['quantity'];
        $lines[] = [
          'product_id' => $p->id,
          'name' => $p->name,
          'price_cents' => $p->price_cents,
          'quantity' => $i['quantity'],
        ];
      }
      $discount = PromotionController::discount($total, $d['promotion_code'] ?? null, $lines);
      $taxPercent = $this->taxPercent();
      $tax = (int) round((($total - $discount['discount_cents']) * $taxPercent) / 100);
      $id = DB::table('orders')->insertGetId([
        'tax_percent' => $taxPercent,
        'tax_cents' => $tax,
        ...$discount,
        ...$this->tableData($d),
        ...$this->contactData(
          $d['contact'] ?? ['name' => $r->user()->name, 'email' => $r->user()->email],
        ),
        'transfer_provider' =>
          ($d['payment_choice'] ?? 'cash') === 'transfer'
            ? $d['transfer_provider'] ?? 'kbzpay'
            : null,
        'transfer_name' =>
          ($d['payment_choice'] ?? 'cash') === 'transfer' ? 'Thawng Kim Piang' : null,
        'transfer_phone' => ($d['payment_choice'] ?? 'cash') === 'transfer' ? '09428981899' : null,
        'payment_choice' => $d['payment_choice'] ?? 'cash',
        'service_type' => $d['service_type'] ?? 'takeaway',
        'user_id' => $r->user()->id,
        'total_cents' => $total - $discount['discount_cents'] + $tax,
        'status' => 'pending',
        'note' => $d['note'] ?? null,
        'created_at' => now(),
        'updated_at' => now(),
      ]);
      DB::table('order_items')->insert(array_map(fn($i) => [...$i, 'order_id' => $id], $lines));
      return $this->notifyOrder($id, 'Order placed');
    }, 3);
    return response()->json($o, 201);
  }
  public function editOrder(Request $r, int $id)
  {
    $d = $r->validate([
      'transfer_provider' => 'sometimes|nullable|in:kbzpay,ayapay',
      'payment_choice' => 'sometimes|in:cash,card,transfer',
      'transfer_name' => 'nullable|string|max:100',
      'transfer_phone' => 'nullable|string|max:40',
      'dining_table_id' => 'nullable|integer|exists:dining_tables,id',
      'promotion_code' => 'nullable|string|max:40',
      'service_type' => 'sometimes|in:dine_in,takeaway',
      'contact' => 'sometimes|array:name,email,phone,location,zip_code',
      'contact.name' => 'required_with:contact|string|max:100',
      'contact.email' => 'required_with:contact|email|max:254',
      'contact.phone' => 'required_with:contact|string|max:40',
      'contact.location' => 'required_with:contact|string|max:500',
      'contact.zip_code' => 'required_with:contact|string|max:20',
      'note' => 'nullable|string|max:500',
      'items' => 'required|array|min:1|max:100',
      'items.*.product_id' => 'required|integer|distinct|exists:products,id',
      'items.*.quantity' => 'required|integer|min:1|max:10000',
    ]);
    return response()->json(
      DB::transaction(function () use ($r, $id, $d) {
        $o = DB::table('orders')->where('id', $id)->lockForUpdate()->first();
        abort_unless($o && (int) $o->user_id === (int) $r->user()->id, 404);
        abort_unless(
          $o->status === 'pending',
          409,
          'This order is already being prepared and cannot be edited.',
        );
        $old = DB::table('order_items')->where('order_id', $id)->get();
        $ids = $old
          ->pluck('product_id')
          ->merge(collect($d['items'])->pluck('product_id'))
          ->unique()
          ->sort()
          ->values();
        DB::table('products')->whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get();
        foreach ($old as $i) {
          DB::table('products')->where('id', $i->product_id)->increment('stock', $i->quantity);
        }
        $lines = [];
        $total = 0;
        foreach (collect($d['items'])->sortBy('product_id') as $i) {
          $p = DB::table('products')->find($i['product_id']);
          if (!$p || !$p->active || $p->stock < $i['quantity']) {
            throw ValidationException::withMessages([
              'items' => 'An item is unavailable or has insufficient stock.',
            ]);
          }
          DB::table('products')->where('id', $p->id)->decrement('stock', $i['quantity']);
          $total += $p->price_cents * $i['quantity'];
          $lines[] = [
            'order_id' => $id,
            'product_id' => $p->id,
            'name' => $p->name,
            'price_cents' => $p->price_cents,
            'quantity' => $i['quantity'],
          ];
        }
        DB::table('order_items')->where('order_id', $id)->delete();
        DB::table('order_items')->insert($lines);
        $discount = PromotionController::discount(
          $total,
          array_key_exists('promotion_code', $d) ? $d['promotion_code'] : $o->promotion_code,
          $lines,
        );
        $taxPercent = $this->taxPercent();
        $tax = (int) round((($total - $discount['discount_cents']) * $taxPercent) / 100);
        DB::table('orders')
          ->where('id', $id)
          ->update([
            ...$discount,
            'tax_percent' => $taxPercent,
            'tax_cents' => $tax,
            ...$this->tableData([
              ...$d,
              'service_type' => $d['service_type'] ?? $o->service_type,
              'dining_table_id' => $d['dining_table_id'] ?? $o->dining_table_id,
            ]),
            ...($d['service_type'] ?? $o->service_type) === 'dine_in'
              ? [
                'contact_name' => null,
                'contact_email' => null,
                'phone' => null,
                'location' => null,
                'zip_code' => null,
              ]
              : $this->contactData($d['contact'] ?? []),
            'transfer_provider' =>
              ($d['payment_choice'] ?? $o->payment_choice) === 'transfer'
                ? $d['transfer_provider'] ?? ($o->transfer_provider ?? 'kbzpay')
                : null,
            'transfer_name' =>
              ($d['payment_choice'] ?? $o->payment_choice) === 'transfer'
                ? 'Thawng Kim Piang'
                : null,
            'transfer_phone' =>
              ($d['payment_choice'] ?? $o->payment_choice) === 'transfer' ? '09428981899' : null,
            'payment_choice' => $d['payment_choice'] ?? $o->payment_choice,
            'service_type' => $d['service_type'] ?? $o->service_type,
            'note' => $d['note'] ?? null,
            'total_cents' => $total - $discount['discount_cents'] + $tax,
            'customer_confirmed_at' => null,
            'updated_at' => now(),
          ]);
        return $this->notifyOrder($id, 'Order updated');
      }, 3),
    );
  }
  public function customerConfirm(Request $r, int $id)
  {
    return response()->json(
      DB::transaction(function () use ($r, $id) {
        $o = DB::table('orders')->where('id', $id)->lockForUpdate()->first();
        abort_unless($o && (int) $o->user_id === (int) $r->user()->id, 404);
        abort_unless(
          $o->status === 'pending',
          409,
          'Only pending orders can be confirmed by the customer.',
        );
        if ($o->customer_confirmed_at) {
          return $this->order($id);
        }
        DB::table('orders')
          ->where('id', $id)
          ->update(['customer_confirmed_at' => now(), 'updated_at' => now()]);
        return $this->notifyOrder($id, 'Customer confirmed order');
      }, 3),
    );
  }
  public function delivery(Request $r, int $id)
  {
    $d = $r->validate([
      'driver_name' => 'required|string|max:100',
      'driver_phone' => 'required|string|max:40',
      'delivery_location' => 'required|string|max:500',
      'delivery_eta' => 'required|date',
      'delivery_status' => 'required|in:assigned,out_for_delivery,delivered',
    ]);
    return response()->json(
      DB::transaction(function () use ($r, $id, $d) {
        $o = DB::table('orders')->where('id', $id)->lockForUpdate()->first();
        abort_unless($o, 404);
        abort_unless(
          $o->service_type === 'takeaway' && $o->status === 'ready',
          409,
          'Delivery can only be managed for ready takeaway orders.',
        );
        $allowed = [
          null => ['assigned'],
          'assigned' => ['assigned', 'out_for_delivery'],
          'out_for_delivery' => ['out_for_delivery', 'delivered'],
        ];
        abort_unless(
          in_array($d['delivery_status'], $allowed[$o->delivery_status] ?? [], true),
          409,
          'Follow the delivery sequence: Assigned, Out for delivery, Delivered.',
        );
        $d['delivery_eta'] = \Illuminate\Support\Carbon::parse($d['delivery_eta'])
          ->utc()
          ->format('Y-m-d H:i:s');
        if (!$o->delivery_status) {
          abort_if(
            \Illuminate\Support\Carbon::parse($d['delivery_eta'], 'UTC')->isPast(),
            422,
            'Estimated delivery time must be in the future.',
          );
        }
        if ($d['delivery_status'] === 'out_for_delivery' && !$o->dispatched_at) {
          $d['dispatched_at'] = now();
        }
        if ($d['delivery_status'] === 'delivered') {
          $d['delivered_at'] = now();
        }
        DB::table('orders')
          ->where('id', $id)
          ->update([...$d, 'updated_at' => now()]);
        $event = match ($d['delivery_status']) {
          'assigned' => 'Delivery assigned',
          'out_for_delivery' => 'Delivery is coming',
          'delivered' => 'Order delivered',
        };
        return $this->notifyOrder($id, $event);
      }, 3),
    );
  }
  public function updateOrder(Request $r, int $id)
  {
    $d = $r->validate([
      'use_points' => 'sometimes|boolean',
      'cardholder_name' => 'nullable|string|max:100',
      'card_last_four' => 'nullable|regex:/^[0-9]{4}$/',
      'payment_method' => 'sometimes|in:cash,card,bank_transfer',
      'transfer_confirmed' => 'sometimes|boolean',
      'card_confirmed' => 'sometimes|boolean',
      'custom_discount_percent' => 'sometimes|numeric|min:0|max:100',
      'custom_discount_cents' => 'sometimes|integer|min:0|max:1000000000',
      'status' => 'required|in:confirmed,ready,completed,cancelled',
      'amount_received_cents' => 'nullable|integer|min:0|max:1000000000',
    ]);
    return response()->json(
      DB::transaction(function () use ($r, $id, $d) {
        $o = DB::table('orders')->where('id', $id)->lockForUpdate()->first();
        abort_unless($o, 404);
        $admin = $r->user()->role === 'admin';
        abort_unless($admin || (int) $o->user_id === (int) $r->user()->id, 404);
        if (!$admin) {
          abort_unless(
            $o->status === 'pending' && $d['status'] === 'cancelled',
            403,
            'Only pending orders can be cancelled.',
          );
        }
        if (
          $admin &&
          $d['status'] === 'confirmed' &&
          $o->service_type === 'takeaway' &&
          !$o->customer_confirmed_at
        ) {
          throw ValidationException::withMessages([
            'status' => 'Wait for the customer to confirm this takeaway order first.',
          ]);
        }
        $next = [
          'pending' => ['confirmed', 'cancelled'],
          'confirmed' => ['ready', 'cancelled'],
          'ready' => ['completed', 'cancelled'],
        ];
        if (!in_array($d['status'], $next[$o->status] ?? [])) {
          throw ValidationException::withMessages([
            'status' => 'This order cannot move to that status.',
          ]);
        }
        $items = DB::table('order_items')->where('order_id', $id)->orderBy('product_id')->get();
        $saleId = null;
        if ($d['status'] === 'cancelled') {
          foreach ($items as $i) {
            DB::table('products')->where('id', $i->product_id)->increment('stock', $i->quantity);
          }
        }
        if ($d['status'] === 'completed') {
          abort_if(
            $o->service_type === 'takeaway' && $o->delivery_status !== 'delivered',
            409,
            'Assign delivery details and mark the delivery as delivered before recording payment.',
          );
          $preTax = max(0, $o->total_cents - $o->tax_cents);
          $custom = isset($d['custom_discount_percent'])
            ? (int) round(($preTax * $d['custom_discount_percent']) / 100)
            : $d['custom_discount_cents'] ?? 0;
          if ($custom > $preTax) {
            throw ValidationException::withMessages([
              'custom_discount_cents' => 'Discount cannot exceed the remaining order total.',
            ]);
          }
          $preTax -= $custom;
          $o->discount_cents += $custom;
          $o->tax_cents = (int) round(($preTax * (float) $o->tax_percent) / 100);
          $o->total_cents = $preTax + $o->tax_cents;
          $pointRows = DB::table('customer_points')
            ->where('user_id', $o->user_id)
            ->lockForUpdate()
            ->get();
          $earned = (int) $pointRows->sum('points');
          $spent = (int) DB::table('sales')
            ->whereIn('id', $pointRows->pluck('sale_id'))
            ->sum('redeemed_points');
          $available = max(0, $earned - $spent);
          $redeemed = !empty($d['use_points'])
            ? min($available, (int) ceil($o->total_cents / 100))
            : 0;
          $pointDiscount = min($o->total_cents, $redeemed * 100);
          $o->total_cents -= $pointDiscount;
          $o->discount_cents += $pointDiscount;
          DB::table('orders')
            ->where('id', $id)
            ->update([
              'total_cents' => $o->total_cents,
              'discount_cents' => $o->discount_cents,
              'tax_cents' => $o->tax_cents,
            ]);
          $method = $d['payment_method'] ?? 'cash';
          if ($method === 'card' && empty($d['card_confirmed'])) {
            throw ValidationException::withMessages([
              'card_confirmed' => 'Confirm approval on the card terminal.',
            ]);
          }
          if ($method === 'bank_transfer' && empty($d['transfer_confirmed'])) {
            throw ValidationException::withMessages([
              'transfer_confirmed' =>
                'Verify the transfer in your merchant account before completing payment.',
            ]);
          }
          $received = $method === 'cash' ? $d['amount_received_cents'] ?? $o->total_cents : null;
          if ($received !== null && $received < $o->total_cents) {
            throw ValidationException::withMessages([
              'amount_received_cents' => 'Cash received must cover the order total.',
            ]);
          }
          $saleId = DB::table('sales')->insertGetId([
            'tax_percent' => $o->tax_percent,
            'tax_cents' => $o->tax_cents,
            'redeemed_points' => $redeemed,
            'point_discount_cents' => $pointDiscount,
            'cardholder_name' => $method === 'card' ? $d['cardholder_name'] ?? null : null,
            'card_last_four' => $method === 'card' ? $d['card_last_four'] ?? null : null,
            'contact_name' => $o->service_type === 'takeaway' ? $o->contact_name : null,
            'contact_email' => $o->service_type === 'takeaway' ? $o->contact_email : null,
            'phone' => $o->service_type === 'takeaway' ? $o->phone : null,
            'location' => $o->service_type === 'takeaway' ? $o->location : null,
            'zip_code' => $o->service_type === 'takeaway' ? $o->zip_code : null,
            'service_type' => $o->service_type,
            'dining_table_id' => $o->dining_table_id,
            'table_name' => $o->table_name,
            'subtotal_cents' => $o->subtotal_cents,
            'discount_cents' => $o->discount_cents,
            'promotion_code' => $o->promotion_code,
            'total_cents' => $o->total_cents,
            'payment_method' => $method,
            'amount_received_cents' => $received,
            'change_cents' => $received === null ? 0 : $received - $o->total_cents,
            'created_at' => now(),
            'updated_at' => now(),
          ]);
          DB::table('customer_points')->insert([
            'user_id' => $o->user_id,
            'sale_id' => $saleId,
            'points' => intdiv($o->total_cents, 100000),
            'created_at' => now(),
          ]);
          DB::table('sale_items')->insert(
            $items
              ->map(
                fn($i) => [
                  'sale_id' => $saleId,
                  'product_id' => $i->product_id,
                  'name' => $i->name,
                  'quantity' => $i->quantity,
                  'price_cents' => $i->price_cents,
                ],
              )
              ->all(),
          );
        }
        DB::table('orders')
          ->where('id', $id)
          ->update([
            'status' => $d['status'],
            'sale_id' => $saleId,
            $d['status'] . '_at' => now(),
            'delivery_status' =>
              $d['status'] === 'cancelled' && $o->delivery_status
                ? 'cancelled'
                : $o->delivery_status,
            'updated_at' => now(),
          ]);
        return $this->notifyOrder($id, 'Order ' . $d['status']);
      }, 3),
    );
  }
  public function updateProduct(Request $r, int $id)
  {
    abort_unless(DB::table('products')->where('id', $id)->exists(), 404);
    $d = $r->validate([
      'name' => 'required|string|max:100',
      'sku' => [
        'required',
        'string',
        'max:100',
        Rule::in([DB::table('products')->where('id', $id)->value('sku')]),
      ],
      'category' => 'required|string|max:60',
      'price_cents' => 'required|integer|min:0|max:100000000',
      'expected_stock' => 'sometimes|integer|min:0|max:1000000',
      'stock' => 'required|integer|min:0|max:1000000',
      'emoji' => 'required|string|max:10',
      'active' => 'required|boolean',
      'image' => 'nullable|image|mimes:jpg,jpeg,png,webp|max:2048',
    ]);
    unset($d['image']);
    $expected = $d['expected_stock'] ?? null;
    unset($d['expected_stock']);
    $old = DB::table('products')->where('id', $id)->value('image_path');
    $path = $r->hasFile('image') ? $r->file('image')->store('products', 'local') : null;
    if ($path) {
      $d['image_path'] = $path;
    }
    try {
      $query = DB::table('products')->where('id', $id);
      if ($expected !== null) {
        $query->where('stock', $expected);
      }
      $updated = $query->update([...$d, 'updated_at' => now()]);
      abort_unless(
        $updated,
        409,
        'Stock changed since you opened this form. Refresh inventory and try again.',
      );
    } catch (\Throwable $e) {
      if ($path) {
        \Illuminate\Support\Facades\Storage::disk('local')->delete($path);
      }
      throw $e;
    }
    if ($path && $old) {
      \Illuminate\Support\Facades\Storage::disk('local')->delete($old);
    }
    return response()->json(DB::table('products')->find($id));
  }
  public function updateStock(Request $r, int $id)
  {
    $d = $r->validate([
      'stock' => 'required|integer|min:0|max:1000000',
      'expected_stock' => 'required|integer|min:0|max:1000000',
    ]);
    return response()->json(
      DB::transaction(function () use ($id, $d) {
        $p = DB::table('products')->where('id', $id)->lockForUpdate()->first();
        abort_unless($p, 404);
        abort_if(
          (int) $p->stock !== (int) $d['expected_stock'],
          409,
          'Stock changed since you opened this form. Refresh inventory and try again.',
        );
        if ((int) $p->stock !== (int) $d['stock']) {
          $updated = DB::table('products')
            ->where('id', $id)
            ->where('stock', $d['expected_stock'])
            ->update(['stock' => $d['stock'], 'updated_at' => now()]);
          abort_unless($updated, 409, 'Stock changed. Refresh inventory and try again.');
        }
        return DB::table('products')->find($id);
      }, 3),
    );
  }
  public function setProductActive(Request $r, int $id)
  {
    abort_unless(DB::table('products')->where('id', $id)->exists(), 404);
    $d = $r->validate(['active' => 'required|boolean']);
    DB::table('products')
      ->where('id', $id)
      ->update(['active' => $r->boolean('active'), 'updated_at' => now()]);
    return response()->json(DB::table('products')->find($id));
  }
  public function deleteProduct(int $id)
  {
    $imagePath = DB::transaction(function () use ($id) {
      $p = DB::table('products')->where('id', $id)->lockForUpdate()->first();
      abort_unless($p, 404);
      foreach (['order_items', 'sale_items', 'purchase_items'] as $table) {
        abort_if(
          DB::table($table)->where('product_id', $id)->exists(),
          409,
          'This product has transaction history. Deactivate it instead.',
        );
      }
      foreach (DB::table('promotions')->whereNull('deleted_at')->get() as $promotion) {
        abort_if(
          in_array($id, json_decode($promotion->product_ids ?? '[]', true) ?? []),
          409,
          'Remove this product from its promotions before deleting it.',
        );
      }
      DB::table('products')->where('id', $id)->delete();
      return $p->image_path;
    });
    if ($imagePath) {
      \Illuminate\Support\Facades\Storage::disk('local')->delete($imagePath);
    }
    return response()->json(['message' => 'Product deleted.']);
  }
  public function archiveProduct(int $id)
  {
    abort_unless(DB::table('products')->where('id', $id)->exists(), 404);
    DB::table('products')
      ->where('id', $id)
      ->update(['active' => false, 'updated_at' => now()]);
    return response()->json(['message' => 'Product archived.']);
  }
  public function dashboard()
  {
    return response()->json([
      'revenue_cents' => (int) DB::table('sales')->sum('total_cents'),
      'sales_count' => DB::table('sales')->count(),
      'pending_orders' => DB::table('orders')
        ->whereIn('status', ['pending', 'confirmed', 'ready'])
        ->count(),
      'customers' => DB::table('users')->where('role', 'customer')->count(),
      'low_stock' => DB::table('products')->where('active', true)->where('stock', '<', 5)->get(),
      'people' => DB::table('users')
        ->select('id', 'name', 'email', 'role', 'created_at')
        ->orderByDesc('id')
        ->get(),
    ]);
  }
}
