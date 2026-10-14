<?php
namespace App\Http\Controllers;
use App\Models\User;
use App\Support\StoreContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
final class AdminCustomerController
{
  public function index(Request $request)
  {
    $data = $request->validate([
      'search' => 'nullable|string|max:100',
      'status' => ['nullable', Rule::in(['active', 'inactive'])],
    ]);
    $query = $this->baseQuery();
    if (!empty($data['status'])) {
      $query->where('store_customers.status', $data['status']);
    }
    if (!empty($data['search'])) {
      $search = '%' . str_replace(['%', '_'], ['\\%', '\\_'], trim($data['search'])) . '%';
      $query->where(
        fn($q) => $q
          ->where('users.name', 'like', $search)
          ->orWhere('users.email', 'like', $search)
          ->orWhere('store_customers.customer_number', 'like', $search),
      );
    }
    return response()->json($query->orderByDesc('store_customers.id')->get());
  }
  public function show(int $id)
  {
    return response()->json($this->customer($id));
  }
  public function store(Request $request)
  {
    $request->merge(['email' => strtolower(trim((string) $request->input('email')))]);
    $data = $request->validate([
      'name' => 'required|string|max:100',
      'email' => 'required|string|email|max:254',
      'password' => 'required|string|min:8|max:128|confirmed',
      'customer_number' => 'nullable|string|max:100',
      'store_notes' => 'nullable|string|max:2000',
    ]);
    if (User::where('email', $data['email'])->exists()) {
      throw ValidationException::withMessages([
        'email' =>
          'This email already belongs to an account. Linking an existing account requires an explicit platform decision.',
      ]);
    }
    $userId = DB::transaction(function () use ($data, $request) {
      $user = User::create([
        'name' => trim($data['name']),
        'email' => $data['email'],
        'password' => $data['password'],
      ]);
      $user->role = 'customer';
      $user->save();
      DB::table('store_customers')->insert([
        'store_id' => app(StoreContext::class)->id(),
        'user_id' => $user->id,
        'status' => 'active',
        'customer_number' => $data['customer_number'] ?? null,
        'store_notes' => $data['store_notes'] ?? null,
        'created_at' => now(),
        'updated_at' => now(),
      ]);
      DB::table('audit_events')->insert([
        'actor_user_id' => $request->user()->id,
        'store_id' => app(StoreContext::class)->id(),
        'action' => 'store.customer.created',
        'subject_type' => 'user',
        'subject_id' => $user->id,
        'created_at' => now(),
      ]);
      return $user->id;
    });
    return response()->json($this->customer($userId), 201);
  }
  public function update(Request $request, int $id)
  {
    $this->customer($id);
    $data = $request->validate([
      'status' => ['required', Rule::in(['active', 'inactive'])],
      'customer_number' => 'nullable|string|max:100',
      'store_notes' => 'nullable|string|max:2000',
    ]);
    DB::table('store_customers')
      ->where('store_id', app(StoreContext::class)->id())
      ->where('user_id', $id)
      ->update([...$data, 'updated_at' => now()]);
    $this->audit($request, $id, 'store.customer.updated');
    return response()->json($this->customer($id));
  }
  public function destroy(Request $request, int $id)
  {
    $this->customer($id);
    DB::table('store_customers')
      ->where('store_id', app(StoreContext::class)->id())
      ->where('user_id', $id)
      ->update(['status' => 'inactive', 'updated_at' => now()]);
    $this->audit($request, $id, 'store.customer.deactivated');
    return response()->json([
      'message' => 'Customer removed from this store. Global account and history were preserved.',
    ]);
  }
  private function baseQuery()
  {
    return DB::table('store_customers')
      ->join('users', 'users.id', '=', 'store_customers.user_id')
      ->where('store_customers.store_id', app(StoreContext::class)->id())
      ->where('users.role', 'customer')
      ->select(
        'users.id',
        'users.name',
        'users.email',
        'users.role',
        'users.created_at',
        'store_customers.status',
        'store_customers.customer_number',
        'store_customers.store_notes',
      );
  }
  private function customer(int $id): object
  {
    $customer = $this->baseQuery()->where('users.id', $id)->first();
    abort_unless($customer, 404);
    return $customer;
  }
  private function audit(Request $request, int $customerId, string $action): void
  {
    DB::table('audit_events')->insert([
      'actor_user_id' => $request->user()->id,
      'store_id' => app(StoreContext::class)->id(),
      'action' => $action,
      'subject_type' => 'user',
      'subject_id' => $customerId,
      'created_at' => now(),
    ]);
  }
}
