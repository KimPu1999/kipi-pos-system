<?php
namespace App\Http\Controllers;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
class AdminCustomerController
{
  private function customer(int $id): User
  {
    $user = User::where('id', $id)->where('role', 'customer')->first();
    abort_unless($user, 404);
    return $user;
  }
  public function update(Request $request, int $id)
  {
    $customer = $this->customer($id);
    $request->merge(['email' => strtolower(trim((string) $request->input('email')))]);
    $data = $request->validate([
      'name' => 'required|string|max:100',
      'email' => ['required', 'email', 'max:254', Rule::unique('users', 'email')->ignore($id)],
      'password' => 'nullable|string|min:8|max:128|confirmed',
    ]);
    $customer->name = trim($data['name']);
    $customer->email = $data['email'];
    if (!empty($data['password'])) {
      $customer->password = $data['password'];
    }
    $customer->save();
    return response()->json($customer->only(['id', 'name', 'email', 'role', 'created_at']));
  }
  public function destroy(int $id)
  {
    $customer = $this->customer($id);
    $customer->name = 'Deleted customer';
    $customer->email =
      'deleted-' . $customer->id . '-' . Str::lower(Str::random(16)) . '@deleted.invalid';
    $customer->password = Str::random(64);
    $customer->role = 'deleted';
    $customer->save();
    return response()->json([
      'message' =>
        'Customer login and personal profile deleted. Transaction records were preserved.',
    ]);
  }
}
