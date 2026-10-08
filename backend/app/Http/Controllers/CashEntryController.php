<?php
namespace App\Http\Controllers;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Services\ExcelExport;
use App\Services\CashbookPdfExport;
class CashEntryController
{
  public function index()
  {
    $entries = DB::table('cash_entries')
      ->leftJoin('users', 'users.id', '=', 'cash_entries.user_id')
      ->select('cash_entries.*', 'users.name as recorded_by')
      ->orderByDesc('entry_date')
      ->orderByDesc('cash_entries.id')
      ->get();
    $in = (int) DB::table('cash_entries')
      ->where('type', 'in')
      ->where('payment_status', 'paid')
      ->sum('amount_cents');
    $out = (int) DB::table('cash_entries')
      ->where('type', 'out')
      ->where('payment_status', 'paid')
      ->sum('amount_cents');
    $unpaid = (int) DB::table('cash_entries')
      ->where('payment_status', 'unpaid')
      ->sum('amount_cents');
    return response()->json([
      'cash_in_cents' => $in,
      'cash_out_cents' => $out,
      'unpaid_cents' => $unpaid,
      'balance_cents' => $in - $out,
      'entries' => $entries,
    ]);
  }
  public function store(Request $request)
  {
    $data = $request->validate([
      'type' => 'required|in:in,out',
      'payment_status' => 'required|in:paid,unpaid',
      'amount_cents' => 'required|integer|min:1|max:100000000000',
      'category' => 'required|string|max:100',
      'reference' => 'nullable|string|max:150',
      'entry_date' => 'required|date_format:Y-m-d',
      'note' => 'nullable|string|max:2000',
    ]);
    $id = DB::table('cash_entries')->insertGetId([
      ...$data,
      'paid_at' => $data['payment_status'] === 'paid' ? now() : null,
      'user_id' => $request->user()->id,
      'created_at' => now(),
      'updated_at' => now(),
    ]);
    return response()->json(DB::table('cash_entries')->find($id), 201);
  }
  public function update(Request $request, int $id)
  {
    $entry = DB::table('cash_entries')->find($id);
    abort_unless($entry, 404);
    abort_if(
      $entry->source_type,
      409,
      'Automatic entries must be managed from their purchase or salary record.',
    );
    $data = $request->validate([
      'type' => 'required|in:in,out',
      'payment_status' => 'required|in:paid,unpaid',
      'amount_cents' => 'required|integer|min:1|max:100000000000',
      'category' => 'required|string|max:100',
      'reference' => 'nullable|string|max:150',
      'entry_date' => 'required|date_format:Y-m-d',
      'note' => 'nullable|string|max:2000',
    ]);
    $paidAt = $data['payment_status'] === 'paid' ? $entry->paid_at ?? now() : null;
    DB::table('cash_entries')
      ->where('id', $id)
      ->update([...$data, 'paid_at' => $paidAt, 'updated_at' => now()]);
    return response()->json(DB::table('cash_entries')->find($id));
  }
  public function pay(int $id)
  {
    $entry = DB::table('cash_entries')->find($id);
    abort_unless($entry, 404);
    abort_if(
      $entry->source_type,
      409,
      'Automatic entries must be managed from their source record.',
    );
    abort_unless($entry->payment_status === 'unpaid', 409, 'This entry is already paid.');
    DB::table('cash_entries')
      ->where('id', $id)
      ->update(['payment_status' => 'paid', 'paid_at' => now(), 'updated_at' => now()]);
    return response()->json(DB::table('cash_entries')->find($id));
  }
  public function export()
  {
    $entries = DB::table('cash_entries')
      ->leftJoin('users', 'users.id', '=', 'cash_entries.user_id')
      ->select('cash_entries.*', 'users.name as recorded_by')
      ->orderBy('entry_date')
      ->orderBy('cash_entries.id')
      ->get();
    $paid = $entries->where('payment_status', 'paid');
    $cashIn = (int) $paid->where('type', 'in')->sum('amount_cents');
    $cashOut = (int) $paid->where('type', 'out')->sum('amount_cents');
    $unpaid = (int) $entries->where('payment_status', 'unpaid')->sum('amount_cents');
    $rows = [
      [
        'ID',
        'Date',
        'Type',
        'Payment status',
        'Amount MMK',
        'Category',
        'Reference',
        'Note',
        'Recorded by',
        'Paid at',
        'Created at',
      ],
    ];
    foreach ($entries as $entry) {
      $rows[] = [
        (int) $entry->id,
        $entry->entry_date,
        $entry->type === 'in' ? 'Cash in' : 'Cash out',
        ucfirst($entry->payment_status),
        $entry->amount_cents / 100,
        $entry->category,
        $entry->reference ?? '',
        $entry->note ?? '',
        $entry->recorded_by ?? '',
        $entry->paid_at ?? '',
        $entry->created_at,
      ];
    }
    $summary = [
      ['Cashbook summary', 'Amount MMK'],
      ['Paid cash in', $cashIn / 100],
      ['Paid cash out', $cashOut / 100],
      ['Cash balance', ($cashIn - $cashOut) / 100],
      ['Total unpaid', $unpaid / 100],
      ['Exported at', now()->timezone('Asia/Yangon')->format('Y-m-d H:i:s')],
      ['Currency', 'MMK'],
    ];
    $path = ExcelExport::create(['Cashbook summary' => $summary, 'Cash entries' => $rows]);
    return response()
      ->download($path, 'kipi-cashbook-' . now()->format('Y-m-d') . '.xlsx', [
        'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Cache-Control' => 'private, no-store',
      ])
      ->deleteFileAfterSend(true);
  }
  public function exportPdf(Request $request)
  {
    $filter =
      $request->validate([
        'filter' => 'nullable|in:all,in,out,paid,unpaid,purchase,employee,manual',
      ])['filter'] ?? 'all';
    $entries = DB::table('cash_entries')
      ->leftJoin('users', 'users.id', '=', 'cash_entries.user_id')
      ->select('cash_entries.*', 'users.name as recorded_by')
      ->orderBy('entry_date')
      ->orderBy('cash_entries.id')
      ->get();
    if (in_array($filter, ['in', 'out'], true)) {
      $entries = $entries->where('type', $filter)->values();
    }
    if (in_array($filter, ['paid', 'unpaid'], true)) {
      $entries = $entries->where('payment_status', $filter)->values();
    }
    if ($filter === 'purchase') {
      $entries = $entries->where('source_type', 'purchase')->values();
    }
    if ($filter === 'employee') {
      $entries = $entries->where('source_type', 'employee_salary')->values();
    }
    if ($filter === 'manual') {
      $entries = $entries->whereNull('source_type')->values();
    }
    $paid = $entries->where('payment_status', 'paid');
    $cashIn = (int) $paid->where('type', 'in')->sum('amount_cents');
    $cashOut = (int) $paid->where('type', 'out')->sum('amount_cents');
    $unpaid = (int) $entries->where('payment_status', 'unpaid')->sum('amount_cents');
    $money = fn(int $c) => number_format($c / 100, 0) . ' MMK';
    $summary = [
      'Paid cash in' => $money($cashIn),
      'Paid cash out' => $money($cashOut),
      'Cash balance' => $money($cashIn - $cashOut),
      'Total unpaid' => $money($unpaid),
    ];
    $path = CashbookPdfExport::create($summary, $entries->all());
    return response()
      ->download($path, 'kipi-cash-history-' . $filter . '-' . now()->format('Y-m-d') . '.pdf', [
        'Content-Type' => 'application/pdf',
        'Cache-Control' => 'private, no-store',
      ])
      ->deleteFileAfterSend(true);
  }
  public function destroy(int $id)
  {
    $entry = DB::table('cash_entries')->find($id);
    abort_unless($entry, 404);
    abort_if($entry->source_type, 409, 'Automatic entries cannot be deleted from the cashbook.');
    DB::table('cash_entries')->where('id', $id)->delete();
    return response()->json(['message' => 'Cash entry deleted.']);
  }
}
