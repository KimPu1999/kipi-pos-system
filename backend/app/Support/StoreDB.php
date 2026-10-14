<?php

namespace App\Support;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

final class StoreDB
{
  private const SCOPED_TABLES = [
    'products',
    'sales',
    'sale_items',
    'orders',
    'order_items',
    'promotions',
    'purchases',
    'purchase_items',
    'employees',
    'employee_shifts',
    'employee_salary_payments',
    'order_emails',
    'customer_points',
    'dining_tables',
    'system_settings',
    'cash_entries',
    'notes',
    'announcements',
    'announcement_reads',
    'wishlists',
    'wishlist_notifications',
  ];

  public static function table(string $table): StoreQuery
  {
    $base = trim(preg_split('/\s+(?:as\s+)?/i', $table)[0]);
    $scoped = in_array($base, self::SCOPED_TABLES, true);
    $storeId = $scoped ? app(StoreContext::class)->id() : null;
    $query = DB::table($table);

    if ($scoped) {
      $column = $base . '.store_id';
      if (app(StoreContext::class)->includesUnassigned()) {
        $query->where(fn(Builder $q) => $q->where($column, $storeId)->orWhereNull($column));
      } else {
        $query->where($column, $storeId);
      }
    }

    return new StoreQuery($query, $scoped, $storeId);
  }

  public static function __callStatic(string $method, array $arguments): mixed
  {
    return DB::{$method}(...$arguments);
  }
}

final class StoreQuery
{
  public function __construct(
    private Builder $query,
    private bool $scoped,
    private ?int $storeId,
  ) {}

  public function __call(string $method, array $arguments): mixed
  {
    $result = $this->query->{$method}(...$arguments);
    return $result instanceof Builder ? $this : $result;
  }

  public function insert(array $values): bool
  {
    return $this->query->insert($this->rows($values));
  }

  public function insertOrIgnore(array $values): int
  {
    return $this->query->insertOrIgnore($this->rows($values));
  }

  public function insertGetId(array $values, ?string $sequence = null): int
  {
    return $this->query->insertGetId($this->row($values), $sequence);
  }

  public function updateOrInsert(array $attributes, array|callable $values = []): bool
  {
    return $this->query->updateOrInsert($this->row($attributes), $values);
  }

  public function upsert(array $values, array|string $uniqueBy, ?array $update = null): int
  {
    return $this->query->upsert($this->rows($values), $uniqueBy, $update);
  }

  private function row(array $row): array
  {
    if ($this->scoped) {
      $row['store_id'] = $this->storeId;
    }
    return $row;
  }

  private function rows(array $values): array
  {
    if ($values === [] || !array_is_list($values) || !is_array($values[0] ?? null)) {
      return $this->row($values);
    }
    return array_map(fn(array $row) => $this->row($row), $values);
  }
}
