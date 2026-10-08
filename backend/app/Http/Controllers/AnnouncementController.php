<?php
namespace App\Http\Controllers;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
class AnnouncementController
{
  public function index(Request $request)
  {
    $query = DB::table('announcements')
      ->leftJoin('users', 'users.id', '=', 'announcements.user_id')
      ->orderByDesc('announcements.id')
      ->limit(50);
    if ($request->user()->role !== 'admin') {
      $query->where('announcements.active', true);
    }
    return response()->json(
      $query
        ->leftJoin('announcement_reads', function ($join) use ($request) {
          $join
            ->on('announcement_reads.announcement_id', '=', 'announcements.id')
            ->where('announcement_reads.user_id', $request->user()->id);
        })
        ->get(['announcements.*', 'users.name as author_name', 'announcement_reads.read_at']),
    );
  }
  public function store(Request $request)
  {
    $data = $request->validate([
      'title' => 'required|string|max:150',
      'message' => 'required|string|max:2000',
    ]);
    $id = DB::table('announcements')->insertGetId([
      ...$data,
      'user_id' => $request->user()->id,
      'active' => true,
      'created_at' => now(),
      'updated_at' => now(),
    ]);
    return response()->json(DB::table('announcements')->find($id), 201);
  }
  public function read(Request $request, int $id)
  {
    abort_unless(
      DB::table('announcements')->where('id', $id)->where('active', true)->exists(),
      404,
    );
    DB::table('announcement_reads')->upsert(
      [['announcement_id' => $id, 'user_id' => $request->user()->id, 'read_at' => now()]],
      ['announcement_id', 'user_id'],
      ['read_at'],
    );
    return response()->json(['message' => 'Announcement read.']);
  }
  public function destroy(int $id)
  {
    abort_unless(DB::table('announcements')->where('id', $id)->exists(), 404);
    DB::table('announcements')->where('id', $id)->delete();
    return response()->json(['message' => 'Announcement deleted.']);
  }
}
