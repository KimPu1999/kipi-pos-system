<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  public function up(): void
  {
    Schema::create('stores', function (Blueprint $t) {
      $t->id();
      $t->string('code')->unique();
      $t->string('name');
      $t->string('status')->default('active')->index();
      $t->string('timezone')->default('Asia/Yangon');
      $t->string('currency', 3)->default('MMK');
      $t->timestamps();
    });
    Schema::create('permissions', function (Blueprint $t) {
      $t->id();
      $t->string('key')->unique();
      $t->string('description');
      $t->timestamps();
    });
    Schema::create('user_permissions', function (Blueprint $t) {
      $t->foreignId('user_id')->constrained()->cascadeOnDelete();
      $t->foreignId('permission_id')->constrained()->cascadeOnDelete();
      $t->foreignId('granted_by')->nullable()->constrained('users')->nullOnDelete();
      $t->timestamp('expires_at')->nullable();
      $t->timestamps();
      $t->primary(['user_id', 'permission_id']);
    });
    Schema::create('store_memberships', function (Blueprint $t) {
      $t->id();
      $t->foreignId('store_id')->constrained()->restrictOnDelete();
      $t->foreignId('user_id')->constrained()->restrictOnDelete();
      $t->string('role')->default('admin');
      $t->string('status')->default('active');
      $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
      $t->timestamps();
      $t->unique(['store_id', 'user_id']);
      $t->index(['user_id', 'status']);
    });
    Schema::create('store_membership_permissions', function (Blueprint $t) {
      $t->foreignId('store_membership_id')->constrained()->cascadeOnDelete();
      $t->foreignId('permission_id')->constrained()->cascadeOnDelete();
      $t->foreignId('granted_by')->nullable()->constrained('users')->nullOnDelete();
      $t->timestamps();
      $t->primary(['store_membership_id', 'permission_id']);
    });
    Schema::create('store_customers', function (Blueprint $t) {
      $t->id();
      $t->foreignId('store_id')->constrained()->restrictOnDelete();
      $t->foreignId('user_id')->constrained()->restrictOnDelete();
      $t->string('status')->default('active');
      $t->string('customer_number')->nullable();
      $t->text('store_notes')->nullable();
      $t->timestamps();
      $t->unique(['store_id', 'user_id']);
    });
    Schema::create('audit_events', function (Blueprint $t) {
      $t->id();
      $t->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
      $t->foreignId('store_id')->nullable()->constrained()->nullOnDelete();
      $t->string('action');
      $t->string('subject_type')->nullable();
      $t->unsignedBigInteger('subject_id')->nullable();
      $t->uuid('request_id')->nullable();
      $t->json('metadata')->nullable();
      $t->timestamp('created_at')->useCurrent();
      $t->index(['store_id', 'created_at']);
    });

    $now = now();
    DB::table('stores')->insert([
      [
        'id' => 1,
        'code' => 'STORE-A',
        'name' => 'Store A',
        'status' => 'active',
        'timezone' => 'Asia/Yangon',
        'currency' => 'MMK',
        'created_at' => $now,
        'updated_at' => $now,
      ],
      [
        'id' => 2,
        'code' => 'STORE-B',
        'name' => 'Store B',
        'status' => 'active',
        'timezone' => 'Asia/Yangon',
        'currency' => 'MMK',
        'created_at' => $now,
        'updated_at' => $now,
      ],
    ]);
    foreach (
      [
        'platform.stores.manage',
        'platform.memberships.manage',
        'platform.legacy.view',
        'platform.legacy.assign',
        'platform.data.read_all',
        'platform.data.write_all',
        'store.products.manage',
        'store.orders.manage',
        'store.finance.view',
        'store.finance.manage',
        'store.employees.manage',
        'store.settings.manage',
        'store.exports.download',
      ]
      as $key
    ) {
      DB::table('permissions')->insert([
        'key' => $key,
        'description' => str_replace('.', ' ', $key),
        'created_at' => $now,
        'updated_at' => $now,
      ]);
    }
    foreach ([[1, 1], [2, 4]] as [$storeId, $userId]) {
      if (DB::table('users')->where('id', $userId)->where('role', 'admin')->exists()) {
        DB::table('store_memberships')->insert([
          'store_id' => $storeId,
          'user_id' => $userId,
          'role' => 'admin',
          'status' => 'active',
          'created_by' => null,
          'created_at' => $now,
          'updated_at' => $now,
        ]);
      }
    }
  }

  public function down(): void
  {
    Schema::dropIfExists('audit_events');
    Schema::dropIfExists('store_customers');
    Schema::dropIfExists('store_membership_permissions');
    Schema::dropIfExists('store_memberships');
    Schema::dropIfExists('user_permissions');
    Schema::dropIfExists('permissions');
    Schema::dropIfExists('stores');
  }
};
