<?php
namespace App\Http\Controllers;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
class DiningTableController
{
  public function index()
  {
    return response()->json(DB::table('dining_tables')->orderBy('id')->get());
  }
  public function choices()
  {
    return response()->json(
      DB::table('dining_tables')
        ->orderBy('id')
        ->get(['id', 'name', 'seats', 'area', 'status']),
    );
  }
  public function store(Request $r)
  {
    return $this->save($r);
  }
  public function update(Request $r, int $id)
  {
    abort_unless(DB::table('dining_tables')->where('id', $id)->exists(), 404);
    return $this->save($r, $id);
  }
  private function save(Request $r, ?int $id = null)
  {
    $d = $r->validate([
      'area' => 'sometimes|required|string|max:100',
      'name' => ['required', 'string', 'max:60', Rule::unique('dining_tables')->ignore($id)],
      'seats' => 'required|integer|min:1|max:100',
      'status' => 'required|in:available,occupied,reserved',
    ]);
    $d['updated_at'] = now();
    if ($id) {
      DB::table('dining_tables')->where('id', $id)->update($d);
    } else {
      $d['created_at'] = now();
      $id = DB::table('dining_tables')->insertGetId($d);
    }
    return response()->json(
      DB::table('dining_tables')->find($id),
      $r->isMethod('POST') ? 201 : 200,
    );
  }
  public function renameArea(Request $r)
  {
    $d = $r->validate(['area' => 'required|string|max:100', 'name' => 'required|string|max:100']);
    $name = trim($d['name']);
    abort_if($name === '', 422, 'Area name is required.');
    $count = DB::table('dining_tables')
      ->where('area', $d['area'])
      ->update(['area' => $name, 'updated_at' => now()]);
    abort_unless($count, 404, 'Area not found.');
    return response()->json(['updated' => $count]);
  }
  public function deleteArea(Request $r)
  {
    $d = $r->validate([
      'area' => 'required|string|max:100',
      'move_to' => 'required|string|max:100|different:area',
    ]);
    $count = DB::transaction(function () use ($d) {
      abort_unless(
        DB::table('dining_tables')->where('area', $d['move_to'])->exists(),
        422,
        'Choose an existing destination area.',
      );
      $count = DB::table('dining_tables')
        ->where('area', $d['area'])
        ->update(['area' => $d['move_to'], 'updated_at' => now()]);
      abort_unless($count, 404, 'Area not found.');
      return $count;
    });
    return response()->json(['moved' => $count]);
  }
  public function bulk(Request $r)
  {
    $d = $r->validate([
      'area' => 'sometimes|required|string|max:100',
      'count' => 'required|integer|min:1|max:100',
      'seats' => 'required|integer|min:1|max:100',
    ]);
    $created = DB::transaction(function () use ($d) {
      $names = DB::table('dining_tables')->pluck('name')->flip();
      $number = 1;
      $rows = [];
      $now = now();
      while (count($rows) < $d['count']) {
        $name = 'Table ' . $number++;
        if ($names->has($name)) {
          continue;
        }
        $rows[] = [
          'area' => $d['area'] ?? 'Dining room',
          'name' => $name,
          'seats' => $d['seats'],
          'status' => 'available',
          'created_at' => $now,
          'updated_at' => $now,
        ];
      }
      DB::table('dining_tables')->insert($rows);
      return count($rows);
    });
    return response()->json(['created' => $created], 201);
  }
  public function destroy(int $id)
  {
    $t = DB::table('dining_tables')->find($id);
    abort_unless($t, 404);
    abort_unless($t->status === 'available', 409, 'Only available tables can be deleted.');
    DB::table('dining_tables')->where('id', $id)->delete();
    return response()->json(['message' => 'Table deleted.']);
  }
}
