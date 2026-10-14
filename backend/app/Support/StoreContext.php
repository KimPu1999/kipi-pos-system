<?php

namespace App\Support;

use RuntimeException;

final class StoreContext
{
  private ?int $storeId = null;
  private bool $platformAccess = false;
  private bool $includeUnassigned = false;

  public function set(
    int $storeId,
    bool $platformAccess = false,
    bool $includeUnassigned = false,
  ): void {
    $this->storeId = $storeId;
    $this->platformAccess = $platformAccess;
    $this->includeUnassigned = $includeUnassigned;
  }

  public function id(): int
  {
    if (!$this->storeId) {
      throw new RuntimeException('A store context is required.');
    }

    return $this->storeId;
  }

  public function hasStore(): bool
  {
    return $this->storeId !== null;
  }

  public function usesPlatformAccess(): bool
  {
    return $this->platformAccess;
  }

  public function includesUnassigned(): bool
  {
    return $this->includeUnassigned;
  }
}
