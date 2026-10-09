<?php
namespace Tests\Feature;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;
class EmployeeTest extends TestCase
{
  use RefreshDatabase;
  public function test_attendance_records_hours_and_prevents_duplicate_actions(): void
  {
    $admin = User::create([
      'name' => 'Admin',
      'email' => 'attendance@example.com',
      'password' => 'password-123',
    ]);
    $admin->role = 'admin';
    $admin->save();
    $this->actingAs($admin);
    $employee = [
      'employee_code' => 'EMP-2',
      'name' => 'Jamie',
      'salary_cents' => 30000,
      'active' => true,
    ];
    $id = $this->postJson('/api/employees', $employee)->assertCreated()->json('id');
    $this->travelTo(\Carbon\Carbon::parse('2026-10-06 02:30:00', 'UTC'));
    $this->postJson('/api/employees/' . $id . '/check-in')->assertOk();
    $this->postJson('/api/employees/' . $id . '/check-in')->assertUnprocessable();
    $this->putJson('/api/employees/' . $id, [
      ...$employee,
      'active' => false,
    ])->assertUnprocessable();
    $this->postJson('/api/employees/' . $id . '/shifts', [
      'date' => '2026-10-06',
      'start_time' => '09:00',
      'end_time' => '10:00',
      'overnight' => false,
      'break_minutes' => 0,
    ])->assertUnprocessable();
    $this->travelTo(\Carbon\Carbon::parse('2026-10-06 11:00:00', 'UTC'));
    $this->postJson('/api/employees/' . $id . '/check-out', [
      'break_minutes' => 510,
    ])->assertUnprocessable();
    $sid = $this->postJson('/api/employees/' . $id . '/check-out', ['break_minutes' => 30])
      ->assertOk()
      ->assertJsonPath('worked_minutes', 480)
      ->json('id');
    $this->assertDatabaseHas('employee_shifts', ['id' => $sid, 'source' => 'attendance']);
    $this->postJson('/api/employees/' . $id . '/check-out', [
      'break_minutes' => 0,
    ])->assertUnprocessable();
    $this->assertDatabaseCount('employee_shifts', 1);
    $this->getJson('/api/employees?month=2026-10')
      ->assertJsonPath('employees.0.worked_minutes', 480)
      ->assertJsonPath('employees.0.checked_in_at', null)
      ->assertJsonPath('employees.0.last_attendance.id', $sid);
    $this->actingAs(
      User::create([
        'name' => 'Customer',
        'email' => 'attcustomer@example.com',
        'password' => 'password-123',
      ]),
    );
    $this->postJson('/api/employees/' . $id . '/check-in')->assertForbidden();
    $this->postJson('/api/employees/' . $id . '/check-out', [
      'break_minutes' => 0,
    ])->assertForbidden();
    $this->travelBack();
  }
  public function test_employees_shifts_hours_validation_and_permissions(): void
  {
    $admin = User::create([
      'name' => 'Admin',
      'email' => 'staffadmin@example.com',
      'password' => 'password-123',
    ]);
    $admin->role = 'admin';
    $admin->save();
    $this->actingAs($admin);
    $employee = [
      'employee_code' => 'EMP-001',
      'name' => 'Alex',
      'salary_cents' => 35000,
      'active' => true,
    ];
    $id = $this->postJson('/api/employees', $employee)->assertCreated()->json('id');
    $this->postJson('/api/employees', $employee)->assertUnprocessable();
    $shift = [
      'date' => '2026-10-06',
      'start_time' => '22:00',
      'end_time' => '06:00',
      'overnight' => true,
      'break_minutes' => 30,
    ];
    $sid = $this->postJson('/api/employees/' . $id . '/shifts', $shift)
      ->assertCreated()
      ->json('id');
    $this->assertDatabaseHas('employee_shifts', ['id' => $sid, 'source' => 'manual']);
    $this->postJson('/api/employees/' . $id . '/shifts', $shift)->assertUnprocessable();
    $this->getJson('/api/employees?month=2026-10')
      ->assertOk()
      ->assertJsonPath('employees.0.worked_minutes', 450)
      ->assertJsonPath('employees.0.last_attendance', null)
      ->assertJsonPath('shifts.0.starts_at', '2026-10-06T15:30:00+00:00');
    $this->get('/api/employees/export-pdf?month=2026-10')
      ->assertOk()
      ->assertHeader('content-type', 'application/pdf')
      ->assertDownload('kipi-employee-shifts-2026-10.pdf');
    $this->getJson('/api/employees?month=2026-11')
      ->assertOk()
      ->assertJsonPath('employees.0.worked_minutes', 0);
    $this->postJson('/api/employees/' . $id . '/shifts', [
      ...$shift,
      'date' => '2026-10-08',
      'overnight' => false,
    ])->assertUnprocessable();
    $this->postJson('/api/employees/' . $id . '/shifts', [
      ...$shift,
      'date' => '2026-10-08',
      'break_minutes' => 480,
    ])->assertUnprocessable();
    $this->putJson('/api/employees/' . $id, [
      ...$employee,
      'salary_cents' => 40000,
      'active' => false,
    ])->assertOk();
    $this->postJson('/api/employees/' . $id . '/shifts', [
      ...$shift,
      'date' => '2026-10-08',
    ])->assertUnprocessable();
    $this->deleteJson('/api/employee-shifts/' . $sid)->assertOk();
    $this->getJson('/api/employees?month=2026-10')->assertJsonPath('employees.0.worked_minutes', 0);
    $this->actingAs(
      User::create([
        'name' => 'Customer',
        'email' => 'staffcustomer@example.com',
        'password' => 'password-123',
      ]),
    );
    $this->getJson('/api/employees')->assertForbidden();
    $this->get('/api/employees/export-pdf?month=2026-10')->assertForbidden();
    $this->postJson('/api/employees', $employee)->assertForbidden();
    $this->postJson('/api/employees/' . $id . '/shifts', $shift)->assertForbidden();
    $this->deleteJson('/api/employee-shifts/' . $sid)->assertForbidden();
  }
  public function test_shift_edit_updates_hours_validates_and_respects_permissions(): void
  {
    $admin = User::create([
      'name' => 'Admin',
      'email' => 'shiftedit@example.com',
      'password' => 'password-123',
    ]);
    $admin->role = 'admin';
    $admin->save();
    $this->actingAs($admin);
    $id = $this->postJson('/api/employees', [
      'employee_code' => 'EMP-77',
      'name' => 'Sam',
      'salary_cents' => 30000,
      'active' => true,
    ])
      ->assertCreated()
      ->json('id');
    $sid = $this->postJson('/api/employees/' . $id . '/shifts', [
      'date' => '2026-10-06',
      'start_time' => '09:00',
      'end_time' => '11:00',
      'overnight' => false,
      'break_minutes' => 15,
    ])
      ->assertCreated()
      ->json('id');
    $this->putJson('/api/employee-shifts/' . $sid, [
      'date' => '2026-10-06',
      'start_time' => '10:00',
      'end_time' => '13:00',
      'overnight' => false,
      'break_minutes' => 30,
    ])
      ->assertOk()
      ->assertJsonPath('worked_minutes', 150)
      ->assertJsonPath('starts_at', '2026-10-06T03:30:00+00:00');
    $this->getJson('/api/employees?month=2026-10')
      ->assertOk()
      ->assertJsonPath('employees.0.worked_minutes', 150)
      ->assertJsonPath('shifts.0.ends_at', '2026-10-06T06:30:00+00:00');
    $this->postJson('/api/employees/' . $id . '/shifts', [
      'date' => '2026-10-07',
      'start_time' => '09:00',
      'end_time' => '17:00',
      'overnight' => false,
      'break_minutes' => 30,
    ])->assertCreated();
    $this->putJson('/api/employee-shifts/' . $sid, [
      'date' => '2026-10-07',
      'start_time' => '10:00',
      'end_time' => '16:00',
      'overnight' => false,
      'break_minutes' => 0,
    ])->assertUnprocessable();
    $this->putJson('/api/employee-shifts/' . $sid, [
      'date' => '2026-10-06',
      'start_time' => '09:00',
      'end_time' => '10:00',
      'overnight' => false,
      'break_minutes' => 0,
    ])->assertOk();
    $this->putJson('/api/employee-shifts/' . $sid, [
      'date' => '2026-10-06',
      'start_time' => '09:00',
      'end_time' => '11:00',
      'overnight' => false,
      'break_minutes' => 300,
    ])->assertUnprocessable();
    $this->putJson('/api/employee-shifts/' . $sid, [
      'date' => '2026-10-06',
      'start_time' => '11:00',
      'end_time' => '09:00',
      'overnight' => false,
      'break_minutes' => 0,
    ])->assertUnprocessable();
    $this->putJson('/api/employee-shifts/99999', [
      'date' => '2026-10-06',
      'start_time' => '09:00',
      'end_time' => '11:00',
      'overnight' => false,
      'break_minutes' => 0,
    ])->assertNotFound();
    $this->actingAs(
      User::create([
        'name' => 'Customer',
        'email' => 'shifteditcustomer@example.com',
        'password' => 'password-123',
      ]),
    );
    $this->putJson('/api/employee-shifts/' . $sid, [
      'date' => '2026-10-06',
      'start_time' => '09:00',
      'end_time' => '11:00',
      'overnight' => false,
      'break_minutes' => 0,
    ])->assertForbidden();
  }
  public function test_employee_delete_removes_shifts_and_blocks_conflicts(): void
  {
    $admin = User::create([
      'name' => 'Admin',
      'email' => 'empdelete@example.com',
      'password' => 'password-123',
    ]);
    $admin->role = 'admin';
    $admin->save();
    $this->actingAs($admin);
    $a = $this->postJson('/api/employees', [
      'employee_code' => 'EMP-100',
      'name' => 'Alpha',
      'salary_cents' => 30000,
      'active' => true,
    ])
      ->assertCreated()
      ->json('id');
    $b = $this->postJson('/api/employees', [
      'employee_code' => 'EMP-101',
      'name' => 'Bravo',
      'salary_cents' => 30000,
      'active' => true,
    ])
      ->assertCreated()
      ->json('id');
    $c = $this->postJson('/api/employees', [
      'employee_code' => 'EMP-102',
      'name' => 'Charlie',
      'salary_cents' => 30000,
      'active' => true,
    ])
      ->assertCreated()
      ->json('id');
    $d = $this->postJson('/api/employees', [
      'employee_code' => 'EMP-103',
      'name' => 'Delta',
      'salary_cents' => 30000,
      'active' => true,
    ])
      ->assertCreated()
      ->json('id');
    $this->postJson('/api/employees/' . $b . '/shifts', [
      'date' => '2026-10-06',
      'start_time' => '09:00',
      'end_time' => '11:00',
      'overnight' => false,
      'break_minutes' => 15,
    ])->assertCreated();
    $this->deleteJson('/api/employees/' . $a)->assertOk()->assertJsonPath('message', 'Employee deleted.');
    $this->assertDatabaseMissing('employees', ['id' => $a]);
    $this->deleteJson('/api/employees/' . $a)->assertNotFound();
    $this->deleteJson('/api/employees/' . $b)->assertOk();
    $this->assertDatabaseMissing('employees', ['id' => $b]);
    $this->assertDatabaseMissing('employee_shifts', ['employee_id' => $b]);
    $this->travelTo(\Carbon\Carbon::parse('2026-10-06 02:30:00', 'UTC'));
    $this->postJson('/api/employees/' . $c . '/check-in')->assertOk();
    $this->deleteJson('/api/employees/' . $c)->assertUnprocessable();
    $this->travelTo(\Carbon\Carbon::parse('2026-10-06 11:00:00', 'UTC'));
    $this->postJson('/api/employees/' . $c . '/check-out', ['break_minutes' => 30])->assertOk();
    $this->deleteJson('/api/employees/' . $c)->assertOk();
    $this->postJson('/api/employees/' . $d . '/salary-payments', [
      'month' => '2026-10',
      'salary_cents' => 30000,
      'bonus_cents' => 0,
      'extra_bonus_cents' => 0,
      'payment_method' => 'cash',
      'paid_on' => '2026-10-08',
      'note' => null,
    ])->assertCreated();
    $this->deleteJson('/api/employees/' . $d)->assertStatus(409);
    $this->assertDatabaseHas('employees', ['id' => $d]);
    $this->actingAs(
      User::create([
        'name' => 'Customer',
        'email' => 'empdeletecustomer@example.com',
        'password' => 'password-123',
      ]),
    );
    $this->deleteJson('/api/employees/' . $d)->assertForbidden();
    $this->travelBack();
  }
  public function test_salary_payment_creates_one_linked_cash_out_entry(): void
  {
    $admin = User::create([
      'name' => 'Admin',
      'email' => 'payroll@example.com',
      'password' => 'password-123',
    ]);
    $admin->role = 'admin';
    $admin->save();
    $this->actingAs($admin);
    $id = $this->postJson('/api/employees', [
      'employee_code' => 'EMP-9',
      'name' => 'Taylor',
      'salary_cents' => 45000000,
      'active' => true,
    ])
      ->assertCreated()
      ->json('id');
    $payment = [
      'month' => '2026-10',
      'salary_cents' => 45000000,
      'bonus_cents' => 1000000,
      'extra_bonus_cents' => 500000,
      'payment_method' => 'cash',
      'paid_on' => '2026-10-08',
      'note' => 'October salary',
    ];
    $paymentId = $this->postJson('/api/employees/' . $id . '/salary-payments', $payment)
      ->assertCreated()
      ->assertJsonPath('month', '2026-10')
      ->json('id');
    $this->assertDatabaseHas('cash_entries', [
      'type' => 'out',
      'payment_status' => 'paid',
      'amount_cents' => 46500000,
      'source_type' => 'employee_salary',
      'source_id' => $paymentId,
    ]);
    $this->getJson('/api/employees?month=2026-10')
      ->assertOk()
      ->assertJsonPath('employees.0.salary_payment.id', $paymentId);
    $this->putJson('/api/employees/' . $id . '/salary-payments/' . $paymentId, [
      'salary_cents' => 46000000,
      'bonus_cents' => 2000000,
      'extra_bonus_cents' => 1000000,
      'payment_method' => 'bank_transfer',
      'paid_on' => '2026-10-09',
      'note' => 'Corrected payroll',
    ])
      ->assertOk()
      ->assertJsonPath('amount_cents', 49000000)
      ->assertJsonPath('bonus_cents', 2000000);
    $this->assertDatabaseHas('cash_entries', [
      'source_type' => 'employee_salary',
      'source_id' => $paymentId,
      'amount_cents' => 49000000,
      'entry_date' => '2026-10-09',
    ]);
    $this->postJson('/api/employees/' . $id . '/salary-payments', $payment)->assertStatus(409);
    $this->assertDatabaseCount('cash_entries', 1);
    $cashId = DB::table('cash_entries')->value('id');
    $this->deleteJson('/api/cash-entries/' . $cashId)->assertStatus(409);
    $this->putJson('/api/cash-entries/' . $cashId, [
      'type' => 'out',
      'payment_status' => 'paid',
      'amount_cents' => 1,
      'category' => 'Changed',
      'entry_date' => '2026-10-08',
    ])->assertStatus(409);
  }
}
