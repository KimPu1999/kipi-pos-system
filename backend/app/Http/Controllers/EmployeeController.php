<?php
namespace App\Http\Controllers;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use App\Services\EmployeeShiftPdfExport;
class EmployeeController
{
  public function index(Request $request)
  {
    $data = $request->validate(['month' => 'nullable|date_format:Y-m']);
    $month = $data['month'] ?? now('Asia/Yangon')->format('Y-m');
    $start = CarbonImmutable::createFromFormat('!Y-m', $month, 'Asia/Yangon')->startOfMonth();
    $end = $start->addMonth();
    $shifts = DB::table('employee_shifts')
      ->where('starts_at', '>=', $start->utc())
      ->where('starts_at', '<', $end->utc())
      ->orderByDesc('starts_at')
      ->get();
    $payments = DB::table('employee_salary_payments')
      ->where('month', $month)
      ->get()
      ->keyBy('employee_id');
    $employees = DB::table('employees')
      ->orderBy('name')
      ->get()
      ->map(function ($e) use ($shifts, $payments) {
        $e->worked_minutes = $shifts->where('employee_id', $e->id)->sum('worked_minutes');
        $e->checked_in_at = $e->checked_in_at
          ? CarbonImmutable::parse($e->checked_in_at, 'UTC')->toIso8601String()
          : null;
        $e->salary_payment = $payments->get($e->id);
        return $e;
      });
    return response()->json([
      'month' => $month,
      'timezone' => 'Asia/Yangon',
      'employees' => $employees,
      'shifts' => $shifts->map(function ($s) {
        $s->starts_at = CarbonImmutable::parse($s->starts_at, 'UTC')->toIso8601String();
        $s->ends_at = CarbonImmutable::parse($s->ends_at, 'UTC')->toIso8601String();
        return $s;
      }),
    ]);
  }
  public function exportPdf(Request $request)
  {
    $month = $request->validate(['month' => 'required|date_format:Y-m'])['month'];
    $start = CarbonImmutable::createFromFormat('!Y-m', $month, 'Asia/Yangon')->startOfMonth();
    $end = $start->addMonth();
    $shifts = DB::table('employee_shifts')
      ->join('employees', 'employees.id', '=', 'employee_shifts.employee_id')
      ->where('employee_shifts.starts_at', '>=', $start->utc())
      ->where('employee_shifts.starts_at', '<', $end->utc())
      ->orderBy('employee_shifts.starts_at')
      ->get(['employee_shifts.*', 'employees.name as employee_name']);
    $employees = DB::table('employees')
      ->orderBy('name')
      ->get()
      ->map(function ($e) use ($shifts) {
        $own = $shifts->where('employee_id', $e->id);
        $minutes = (int) $own->sum('worked_minutes');
        $days = $own
          ->map(
            fn($s) => CarbonImmutable::parse($s->starts_at, 'UTC')
              ->timezone('Asia/Yangon')
              ->format('Y-m-d'),
          )
          ->unique()
          ->count();
        return [
          $e->employee_code,
          $e->name,
          self::hours($minutes),
          $own->count(),
          $days,
          number_format($e->salary_cents / 100, 0),
          $e->active ? 'Active' : 'Inactive',
        ];
      })
      ->all();
    $shiftRows = $shifts
      ->map(
        fn($s) => [
          $s->employee_name,
          CarbonImmutable::parse($s->starts_at, 'UTC')
            ->timezone('Asia/Yangon')
            ->format('Y-m-d H:i'),
          CarbonImmutable::parse($s->ends_at, 'UTC')->timezone('Asia/Yangon')->format('Y-m-d H:i'),
          $s->break_minutes . ' min',
          self::hours((int) $s->worked_minutes),
        ],
      )
      ->all();
    $totalMinutes = (int) $shifts->sum('worked_minutes');
    $salary = (int) DB::table('employees')->where('active', true)->sum('salary_cents');
    $summary = [
      'Employees' => (string) count($employees),
      'Total hours' => self::hours($totalMinutes),
      'Recorded shifts' => (string) $shifts->count(),
      'Active salaries' => number_format($salary / 100, 0) . ' MMK',
    ];
    $path = EmployeeShiftPdfExport::create($month, $summary, $employees, $shiftRows);
    return response()
      ->download($path, 'kipi-employee-shifts-' . $month . '.pdf', [
        'Content-Type' => 'application/pdf',
        'Cache-Control' => 'private, no-store',
      ])
      ->deleteFileAfterSend(true);
  }
  private static function hours(int $minutes): string
  {
    return intdiv($minutes, 60) . 'h ' . $minutes % 60 . 'm';
  }
  public function store(Request $r)
  {
    return $this->save($r);
  }
  public function update(Request $r, int $id)
  {
    abort_unless(DB::table('employees')->where('id', $id)->exists(), 404);
    return $this->save($r, $id);
  }
  private function save(Request $r, ?int $id = null)
  {
    $data = $r->validate([
      'employee_code' => ['required', 'string', 'max:50', Rule::unique('employees')->ignore($id)],
      'name' => 'required|string|max:150',
      'salary_cents' => 'required|integer|min:0|max:1000000000',
      'active' => 'required|boolean',
    ]);
    if (
      $id &&
      !$data['active'] &&
      DB::table('employees')->where('id', $id)->whereNotNull('checked_in_at')->exists()
    ) {
      throw ValidationException::withMessages([
        'active' => 'Check out this employee before deactivating.',
      ]);
    }
    $data['updated_at'] = now();
    if ($id) {
      DB::table('employees')->where('id', $id)->update($data);
    } else {
      $data['created_at'] = now();
      $id = DB::table('employees')->insertGetId($data);
    }
    return response()->json(DB::table('employees')->find($id), $r->isMethod('POST') ? 201 : 200);
  }
  public function shift(Request $r, int $id)
  {
    $data = $r->validate([
      'date' => 'required|date_format:Y-m-d',
      'start_time' => 'required|date_format:H:i',
      'end_time' => 'required|date_format:H:i',
      'overnight' => 'required|boolean',
      'break_minutes' => 'required|integer|min:0|max:1440',
    ]);
    $start = CarbonImmutable::parse($data['date'] . ' ' . $data['start_time'], 'Asia/Yangon');
    $end = CarbonImmutable::parse($data['date'] . ' ' . $data['end_time'], 'Asia/Yangon');
    if ($data['overnight']) {
      $end = $end->addDay();
    }
    $minutes = (int) $start->diffInMinutes($end, false);
    if ($minutes <= 0 || $minutes > 1440 || $data['break_minutes'] >= $minutes) {
      throw ValidationException::withMessages([
        'end_time' => 'Shift must be between 1 minute and 24 hours, with a shorter break.',
      ]);
    }
    $shiftId = DB::transaction(function () use ($id, $start, $end, $minutes, $data) {
      $employee = DB::table('employees')->where('id', $id)->lockForUpdate()->first();
      abort_unless($employee, 404);
      if (
        $employee->checked_in_at &&
        $end->utc()->greaterThan(CarbonImmutable::parse($employee->checked_in_at, 'UTC'))
      ) {
        throw ValidationException::withMessages([
          'date' => 'This shift overlaps the current check-in.',
        ]);
      }
      if (!$employee->active) {
        throw ValidationException::withMessages([
          'employee' => 'Activate this employee before adding a shift.',
        ]);
      }
      if (
        DB::table('employee_shifts')
          ->where('employee_id', $id)
          ->where('starts_at', '<', $end->utc())
          ->where('ends_at', '>', $start->utc())
          ->exists()
      ) {
        throw ValidationException::withMessages([
          'date' => 'This shift overlaps an existing shift.',
        ]);
      }
      return DB::table('employee_shifts')->insertGetId([
        'employee_id' => $id,
        'starts_at' => $start->utc(),
        'ends_at' => $end->utc(),
        'break_minutes' => $data['break_minutes'],
        'worked_minutes' => $minutes - $data['break_minutes'],
        'created_at' => now(),
        'updated_at' => now(),
      ]);
    });
    return response()->json(['id' => $shiftId], 201);
  }
  public function checkIn(int $id)
  {
    return DB::transaction(function () use ($id) {
      $e = DB::table('employees')->where('id', $id)->lockForUpdate()->first();
      abort_unless($e, 404);
      if (!$e->active || $e->checked_in_at) {
        throw ValidationException::withMessages([
          'employee' => 'Employee is inactive or already checked in.',
        ]);
      }
      $now = CarbonImmutable::now('UTC')->startOfSecond();
      if (
        DB::table('employee_shifts')
          ->where('employee_id', $id)
          ->where('ends_at', '>', $now)
          ->exists()
      ) {
        throw ValidationException::withMessages([
          'employee' => 'A recorded shift conflicts with this check-in.',
        ]);
      }
      DB::table('employees')
        ->where('id', $id)
        ->update(['checked_in_at' => $now, 'updated_at' => $now]);
      return response()->json(['checked_in_at' => $now->toIso8601String()]);
    });
  }
  public function checkOut(Request $r, int $id)
  {
    $data = $r->validate(['break_minutes' => 'required|integer|min:0|max:100000']);
    return DB::transaction(function () use ($id, $data) {
      $e = DB::table('employees')->where('id', $id)->lockForUpdate()->first();
      abort_unless($e, 404);
      if (!$e->checked_in_at) {
        throw ValidationException::withMessages(['employee' => 'Employee is not checked in.']);
      }
      $start = CarbonImmutable::parse($e->checked_in_at, 'UTC');
      $end = CarbonImmutable::now('UTC')->startOfSecond();
      $minutes = (int) $start->diffInMinutes($end, false);
      if ($minutes < 1 || $data['break_minutes'] >= $minutes) {
        throw ValidationException::withMessages([
          'break_minutes' =>
            'Work at least one minute. Break must be shorter than the attendance duration.',
        ]);
      }
      $shift = DB::table('employee_shifts')->insertGetId([
        'employee_id' => $id,
        'starts_at' => $start,
        'ends_at' => $end,
        'break_minutes' => $data['break_minutes'],
        'worked_minutes' => $minutes - $data['break_minutes'],
        'created_at' => $end,
        'updated_at' => $end,
      ]);
      DB::table('employees')
        ->where('id', $id)
        ->update(['checked_in_at' => null, 'updated_at' => $end]);
      return response()->json([
        'id' => $shift,
        'worked_minutes' => $minutes - $data['break_minutes'],
      ]);
    });
  }
  public function deleteShift(int $id)
  {
    abort_unless(DB::table('employee_shifts')->where('id', $id)->delete(), 404);
    return response()->json(['message' => 'Shift removed.']);
  }
  public function paySalary(Request $r, int $id)
  {
    $data = $r->validate([
      'month' => 'required|date_format:Y-m',
      'salary_cents' => 'required|integer|min:0|max:100000000000',
      'bonus_cents' => 'required|integer|min:0|max:100000000000',
      'extra_bonus_cents' => 'required|integer|min:0|max:100000000000',
      'payment_method' => 'required|in:cash,bank_transfer,card',
      'paid_on' => 'required|date_format:Y-m-d',
      'note' => 'nullable|string|max:2000',
    ]);
    $data['amount_cents'] =
      $data['salary_cents'] + $data['bonus_cents'] + $data['extra_bonus_cents'];
    if ($data['amount_cents'] < 1) {
      throw ValidationException::withMessages([
        'salary_cents' => 'The total salary payment must be at least 1 MMK.',
      ]);
    }
    $paymentId = DB::transaction(function () use ($r, $id, $data) {
      $employee = DB::table('employees')->where('id', $id)->lockForUpdate()->first();
      abort_unless($employee, 404);
      if (
        DB::table('employee_salary_payments')
          ->where('employee_id', $id)
          ->where('month', $data['month'])
          ->exists()
      ) {
        abort(409, 'Salary is already paid for this employee and month.');
      }
      $now = now();
      $paymentId = DB::table('employee_salary_payments')->insertGetId([
        'employee_id' => $id,
        'user_id' => $r->user()->id,
        ...$data,
        'created_at' => $now,
        'updated_at' => $now,
      ]);
      $cashId = DB::table('cash_entries')->insertGetId([
        'user_id' => $r->user()->id,
        'type' => 'out',
        'payment_status' => 'paid',
        'paid_at' => $now,
        'amount_cents' => $data['amount_cents'],
        'category' => 'Employee salary',
        'reference' => $employee->employee_code . ' · ' . $data['month'],
        'entry_date' => $data['paid_on'],
        'note' =>
          'Automatic salary cash out · ' .
          str_replace('_', ' ', $data['payment_method']) .
          ($data['note'] ? ' · ' . $data['note'] : ''),
        'source_type' => 'employee_salary',
        'source_id' => $paymentId,
        'created_at' => $now,
        'updated_at' => $now,
      ]);
      DB::table('employee_salary_payments')
        ->where('id', $paymentId)
        ->update(['cash_entry_id' => $cashId]);
      return $paymentId;
    });
    return response()->json(DB::table('employee_salary_payments')->find($paymentId), 201);
  }
  public function updateSalaryPayment(Request $r, int $id, int $paymentId)
  {
    $data = $r->validate([
      'salary_cents' => 'required|integer|min:0|max:100000000000',
      'bonus_cents' => 'required|integer|min:0|max:100000000000',
      'extra_bonus_cents' => 'required|integer|min:0|max:100000000000',
      'payment_method' => 'required|in:cash,bank_transfer,card',
      'paid_on' => 'required|date_format:Y-m-d',
      'note' => 'nullable|string|max:2000',
    ]);
    $data['amount_cents'] =
      $data['salary_cents'] + $data['bonus_cents'] + $data['extra_bonus_cents'];
    if ($data['amount_cents'] < 1) {
      throw ValidationException::withMessages([
        'salary_cents' => 'The total salary payment must be at least 1 MMK.',
      ]);
    }
    $payment = DB::transaction(function () use ($id, $paymentId, $data) {
      $employee = DB::table('employees')->where('id', $id)->lockForUpdate()->first();
      abort_unless($employee, 404);
      $payment = DB::table('employee_salary_payments')
        ->where('id', $paymentId)
        ->where('employee_id', $id)
        ->lockForUpdate()
        ->first();
      abort_unless($payment, 404);
      $now = now();
      DB::table('employee_salary_payments')
        ->where('id', $paymentId)
        ->update([...$data, 'updated_at' => $now]);
      DB::table('cash_entries')
        ->where('id', $payment->cash_entry_id)
        ->where('source_type', 'employee_salary')
        ->where('source_id', $paymentId)
        ->update([
          'amount_cents' => $data['amount_cents'],
          'entry_date' => $data['paid_on'],
          'reference' => $employee->employee_code . ' · ' . $payment->month,
          'note' =>
            'Automatic salary cash out · ' .
            str_replace('_', ' ', $data['payment_method']) .
            ($data['note'] ? ' · ' . $data['note'] : ''),
          'updated_at' => $now,
        ]);
      return DB::table('employee_salary_payments')->find($paymentId);
    });
    return response()->json($payment);
  }
}
