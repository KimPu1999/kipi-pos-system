<?php
namespace App\Http\Controllers;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;
use App\Services\ExcelExport;
class ExportController extends \Illuminate\Routing\Controller
{
  public function download(Request $request)
  {
    $d = $request->validate([
      'range' => 'required|in:30days,month,older,all',
      'month' => 'required_if:range,month|date_format:Y-m',
    ]);
    $now = Carbon::now('Asia/Yangon');
    $from = null;
    $until = null;
    if ($d['range'] === '30days') {
      $from = $now->copy()->startOfDay()->subDays(29)->utc();
      $until = $now->copy()->addDay()->startOfDay()->utc();
    }
    if ($d['range'] === 'older') {
      $until = $now->copy()->startOfDay()->subDays(29)->utc();
    }
    if ($d['range'] === 'month') {
      $from = Carbon::createFromFormat('!Y-m', $d['month'], 'Asia/Yangon')->startOfMonth()->utc();
      $until = $from->copy()->timezone('Asia/Yangon')->addMonth()->utc();
    }
    $sheets = DB::transaction(function () use ($from, $until, $d) {
      $query = function ($table, $column = 'created_at') use ($from, $until) {
        $q = DB::table($table);
        if ($from) {
          $q->where(
            $column,
            '>=',
            $column === 'purchased_on'
              ? $from->copy()->timezone('Asia/Yangon')->toDateString()
              : $from,
          );
        }
        if ($until) {
          $q->where(
            $column,
            '<',
            $column === 'purchased_on'
              ? $until->copy()->timezone('Asia/Yangon')->toDateString()
              : $until,
          );
        }
        return $q;
      };
      $orders = $query('orders')->orderBy('id')->get();
      $sales = $query('sales')->orderBy('id')->get();
      $purchases = $query('purchases', 'purchased_on')->orderBy('id')->get();
      $sheet = function ($records, $columns) {
        $rows = [array_values($columns)];
        foreach ($records as $record) {
          $row = [];
          foreach ($columns as $field => $label) {
            $value = $record->$field ?? '';
            if (str_ends_with($field, '_cents') && $value !== '') {
              $value = $value / 100;
            }
            if (str_ends_with($field, '_at') && $value) {
              $value = Carbon::parse($value, 'UTC')->timezone('Asia/Yangon')->format('Y-m-d H:i:s');
            }
            $row[] = $value;
          }
          $rows[] = $row;
        }
        return $rows;
      };
      return [
        'Export information' => [
          ['Field', 'Value'],
          ['Store', 'Kipi POS'],
          ['Date range', $d['range']],
          ['Month', $d['month'] ?? ''],
          ['Timezone', 'Asia/Yangon'],
          ['Currency', 'MMK'],
          ['Inventory', 'Current snapshot, not historical'],
          ['Retention', 'Records remain in the database'],
        ],
        'Orders' => $sheet($orders, [
          'id' => 'Order ID',
          'user_id' => 'Customer ID',
          'status' => 'Status',
          'service_type' => 'Order type',
          'table_name' => 'Table',
          'contact_name' => 'Contact name',
          'contact_email' => 'Contact email',
          'phone' => 'Phone',
          'location' => 'Location',
          'zip_code' => 'Zip code',
          'subtotal_cents' => 'Subtotal MMK',
          'discount_cents' => 'Discount MMK',
          'total_cents' => 'Total MMK',
          'payment_choice' => 'Payment choice',
          'transfer_provider' => 'Wallet',
          'sale_id' => 'Receipt ID',
          'note' => 'Notes',
          'customer_confirmed_at' => 'Customer confirmed',
          'confirmed_at' => 'Store confirmed',
          'ready_at' => 'Ready',
          'created_at' => 'Created',
        ]),
        'Order items' => $sheet(
          DB::table('order_items')->whereIn('order_id', $orders->pluck('id'))->get(),
          [
            'order_id' => 'Order ID',
            'product_id' => 'Product ID',
            'name' => 'Item',
            'quantity' => 'Quantity',
            'price_cents' => 'Unit price MMK',
          ],
        ),
        'Bills and receipts' => $sheet($sales, [
          'id' => 'Receipt ID',
          'service_type' => 'Order type',
          'table_name' => 'Table',
          'contact_name' => 'Customer',
          'contact_email' => 'Email',
          'phone' => 'Phone',
          'subtotal_cents' => 'Subtotal MMK',
          'discount_cents' => 'Discount MMK',
          'tax_percent' => 'Tax %',
          'tax_cents' => 'Tax MMK',
          'total_cents' => 'Paid total MMK',
          'payment_method' => 'Payment method',
          'amount_received_cents' => 'Received MMK',
          'change_cents' => 'Change MMK',
          'created_at' => 'Paid at',
        ]),
        'Receipt items' => $sheet(
          DB::table('sale_items')->whereIn('sale_id', $sales->pluck('id'))->get(),
          [
            'sale_id' => 'Receipt ID',
            'product_id' => 'Product ID',
            'name' => 'Item',
            'quantity' => 'Quantity',
            'price_cents' => 'Unit price MMK',
          ],
        ),
        'Purchases' => $sheet($purchases, [
          'id' => 'Purchase ID',
          'supplier' => 'Supplier',
          'reference' => 'Invoice',
          'purchased_on' => 'Purchase date',
          'payment_status' => 'Payment status',
          'payment_method' => 'Payment method',
          'total_cents' => 'Total MMK',
          'note' => 'Notes',
        ]),
        'Purchase items' => $sheet(
          DB::table('purchase_items')->whereIn('purchase_id', $purchases->pluck('id'))->get(),
          [
            'purchase_id' => 'Purchase ID',
            'product_id' => 'Product ID',
            'name' => 'Item',
            'quantity' => 'Quantity',
            'unit_cost_cents' => 'Unit cost MMK',
          ],
        ),
        'Current inventory' => $sheet(DB::table('products')->orderBy('id')->get(), [
          'id' => 'Product ID',
          'name' => 'Product',
          'sku' => 'SKU',
          'category' => 'Category',
          'stock' => 'Available stock',
          'active' => 'Active',
          'price_cents' => 'Unit price MMK',
        ]),
      ];
    });
    $path = ExcelExport::create($sheets);
    return response()
      ->download(
        $path,
        'kipi-pos-' . $d['range'] . '-' . ($d['month'] ?? $now->format('Y-m-d')) . '.xlsx',
        [
          'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Cache-Control' => 'private, no-store',
        ],
      )
      ->deleteFileAfterSend(true);
  }
}
