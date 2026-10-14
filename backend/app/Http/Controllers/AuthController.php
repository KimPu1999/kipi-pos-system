<?php
namespace App\Http\Controllers;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
class AuthController
{
  public function register(Request $request)
  {
    abort(403, 'Please contact your store administrator to create an account.');
  }
  public function login(Request $request)
  {
    $request->merge(['email' => strtolower(trim((string) $request->input('email')))]);
    $credentials = $request->validate([
      'email' => 'required|string|email|max:254',
      'password' => 'required|string|max:128',
    ]);
    if (!Auth::attempt($credentials)) {
      throw ValidationException::withMessages(['email' => 'The email or password is incorrect.']);
    }
    $user = $request->user();
    if ($user->role === 'customer' && !$this->customerIsActive($user->id)) {
      Auth::logout();
      $request->session()->invalidate();
      throw ValidationException::withMessages([
        'email' => 'This account is inactive. Please contact your store administrator.',
      ]);
    }
    $request->session()->regenerate();
    return response()->json($request->user());
  }
  public function logout(Request $request)
  {
    Auth::logout();
    $request->session()->invalidate();
    $request->session()->regenerateToken();
    return response()->json(['message' => 'Signed out successfully.']);
  }
  /**
   * A customer may only authenticate while linked to at least one active store.
   * Accounts with no store relationship rows are preserved (legacy global users).
   */
  private function customerIsActive(int $userId): bool
  {
    $hasRelationships = DB::table('store_customers')->where('user_id', $userId)->exists();
    if (!$hasRelationships) {
      return true;
    }
    return DB::table('store_customers')
      ->where('user_id', $userId)
      ->where('status', 'active')
      ->exists();
  }
}
