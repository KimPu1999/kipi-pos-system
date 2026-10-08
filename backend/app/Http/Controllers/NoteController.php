<?php
namespace App\Http\Controllers;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
class NoteController
{
  public function index(Request $r)
  {
    return response()->json(
      DB::table('notes')
        ->where('user_id', $r->user()->id)
        ->orderByDesc('pinned')
        ->orderByDesc('updated_at')
        ->get(),
    );
  }
  public function store(Request $r)
  {
    $data = $this->validate($r);
    $file = $this->storeFile($r);
    $id = DB::table('notes')->insertGetId([
      ...$data,
      ...$file,
      'user_id' => $r->user()->id,
      'created_at' => now(),
      'updated_at' => now(),
    ]);
    return response()->json(DB::table('notes')->find($id), 201);
  }
  public function update(Request $r, int $id)
  {
    $note = $this->owned($r, $id);
    $data = $this->validate($r);
    $file = $this->storeFile($r);
    try {
      DB::table('notes')
        ->where('id', $id)
        ->update([...$data, ...$file, 'updated_at' => now()]);
    } catch (\Throwable $e) {
      if (isset($file['file_path'])) {
        Storage::disk('local')->delete($file['file_path']);
      }
      throw $e;
    }
    if ($file && $note->file_path) {
      Storage::disk('local')->delete($note->file_path);
    }
    return response()->json(DB::table('notes')->find($id));
  }
  public function download(Request $r, int $id)
  {
    $note = $this->owned($r, $id);
    abort_unless($note->file_path && Storage::disk('local')->exists($note->file_path), 404);
    return response()->download(Storage::disk('local')->path($note->file_path), $note->file_name, [
      'Content-Type' => $note->file_mime,
      'X-Content-Type-Options' => 'nosniff',
      'Cache-Control' => 'private, no-store',
    ]);
  }
  public function destroy(Request $r, int $id)
  {
    $note = $this->owned($r, $id);
    DB::table('notes')->where('id', $id)->delete();
    if ($note->file_path) {
      Storage::disk('local')->delete($note->file_path);
    }
    return response()->json(['message' => 'Note deleted.']);
  }
  private function validate(Request $r): array
  {
    $d = $r->validate([
      'title' => 'required|string|max:150',
      'category' => 'required|string|max:60',
      'content' => 'required|string|max:10000',
      'pinned' => 'required|boolean',
      'excel_file' => 'nullable|file|mimes:xlsx,xls,csv,png,jpg,jpeg|max:10240',
    ]);
    unset($d['excel_file']);
    return $d;
  }
  private function storeFile(Request $r): array
  {
    if (!$r->hasFile('excel_file')) {
      return [];
    }
    $file = $r->file('excel_file');
    return [
      'file_name' => $file->getClientOriginalName(),
      'file_path' => $file->store('notes', 'local'),
      'file_mime' => $file->getMimeType() ?: 'application/octet-stream',
      'file_size' => $file->getSize(),
    ];
  }
  private function owned(Request $r, int $id): object
  {
    $note = DB::table('notes')->where('id', $id)->where('user_id', $r->user()->id)->first();
    abort_unless($note, 404);
    return $note;
  }
}
