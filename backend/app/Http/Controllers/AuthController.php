<?php
namespace App\Http\Controllers;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
class AuthController
{
  public function register(Request $request)
  {
    $request->merge(['email' => strtolower(trim((string) $request->input('email')))]);
    $data = $request->validate([
      'name' => 'required|string|max:100',
      'email' => 'required|string|email|max:254|unique:users,email',
      'password' => 'required|string|min:8|max:128|confirmed',
    ]);
    $user = User::create($data)->refresh();
    Auth::login($user);
    $request->session()->regenerate();
    return response()->json($user, 201);
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
}
