<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  private array $tables = [
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

  public function up(): void
  {
    foreach ($this->tables as $table) {
      Schema::table($table, function (Blueprint $t) use ($table) {
        $t->foreignId('store_id')->nullable()->constrained('stores')->restrictOnDelete();
        $t->index(['store_id'], $table . '_store_idx');
      });
    }
    DB::table('system_settings')
      ->where('id', 1)
      ->update(['store_id' => 1]);
    Schema::table('products', fn(Blueprint $t) => $t->dropUnique('products_sku_unique'));
    Schema::table('promotions', fn(Blueprint $t) => $t->dropUnique('promotions_code_unique'));
    Schema::table(
      'employees',
      fn(Blueprint $t) => $t->dropUnique('employees_employee_code_unique'),
    );
    Schema::table('dining_tables', fn(Blueprint $t) => $t->dropUnique('dining_tables_name_unique'));
    Schema::table('purchases', fn(Blueprint $t) => $t->dropUnique('purchases_request_id_unique'));
    Schema::table(
      'employee_salary_payments',
      fn(Blueprint $t) => $t->dropUnique('employee_salary_payments_employee_id_month_unique'),
    );
    Schema::table(
      'cash_entries',
      fn(Blueprint $t) => $t->dropUnique('cash_entries_source_type_source_id_unique'),
    );
    Schema::table(
      'customer_points',
      fn(Blueprint $t) => $t->dropUnique('customer_points_sale_id_unique'),
    );
    Schema::table(
      'wishlists',
      fn(Blueprint $t) => $t->dropUnique('wishlists_user_id_product_id_unique'),
    );
    Schema::table(
      'products',
      fn(Blueprint $t) => $t->unique(['store_id', 'sku'], 'products_store_sku_unique'),
    );
    Schema::table(
      'promotions',
      fn(Blueprint $t) => $t->unique(['store_id', 'code'], 'promotions_store_code_unique'),
    );
    Schema::table(
      'employees',
      fn(Blueprint $t) => $t->unique(['store_id', 'employee_code'], 'employees_store_code_unique'),
    );
    Schema::table(
      'dining_tables',
      fn(Blueprint $t) => $t->unique(['store_id', 'name'], 'tables_store_name_unique'),
    );
    Schema::table(
      'purchases',
      fn(Blueprint $t) => $t->unique(['store_id', 'request_id'], 'purchases_store_request_unique'),
    );
    Schema::table(
      'employee_salary_payments',
      fn(Blueprint $t) => $t->unique(
        ['store_id', 'employee_id', 'month'],
        'salary_store_employee_month_unique',
      ),
    );
    Schema::table(
      'cash_entries',
      fn(Blueprint $t) => $t->unique(
        ['store_id', 'source_type', 'source_id'],
        'cash_store_source_unique',
      ),
    );
    Schema::table(
      'customer_points',
      fn(Blueprint $t) => $t->unique(['store_id', 'sale_id'], 'points_store_sale_unique'),
    );
    Schema::table(
      'wishlists',
      fn(Blueprint $t) => $t->unique(
        ['store_id', 'user_id', 'product_id'],
        'wishlists_store_user_product_unique',
      ),
    );
    Schema::table(
      'system_settings',
      fn(Blueprint $t) => $t->unique('store_id', 'settings_store_unique'),
    );
  }

  public function down(): void
  {
    Schema::table('system_settings', fn(Blueprint $t) => $t->dropUnique('settings_store_unique'));
    Schema::table(
      'wishlists',
      fn(Blueprint $t) => $t->dropUnique('wishlists_store_user_product_unique'),
    );
    Schema::table(
      'customer_points',
      fn(Blueprint $t) => $t->dropUnique('points_store_sale_unique'),
    );
    Schema::table('cash_entries', fn(Blueprint $t) => $t->dropUnique('cash_store_source_unique'));
    Schema::table(
      'employee_salary_payments',
      fn(Blueprint $t) => $t->dropUnique('salary_store_employee_month_unique'),
    );
    Schema::table(
      'purchases',
      fn(Blueprint $t) => $t->dropUnique('purchases_store_request_unique'),
    );
    Schema::table('dining_tables', fn(Blueprint $t) => $t->dropUnique('tables_store_name_unique'));
    Schema::table('employees', fn(Blueprint $t) => $t->dropUnique('employees_store_code_unique'));
    Schema::table('promotions', fn(Blueprint $t) => $t->dropUnique('promotions_store_code_unique'));
    Schema::table('products', fn(Blueprint $t) => $t->dropUnique('products_store_sku_unique'));
    Schema::table('wishlists', fn(Blueprint $t) => $t->unique(['user_id', 'product_id']));
    Schema::table('customer_points', fn(Blueprint $t) => $t->unique('sale_id'));
    Schema::table('cash_entries', fn(Blueprint $t) => $t->unique(['source_type', 'source_id']));
    Schema::table(
      'employee_salary_payments',
      fn(Blueprint $t) => $t->unique(['employee_id', 'month']),
    );
    Schema::table('purchases', fn(Blueprint $t) => $t->unique('request_id'));
    Schema::table('dining_tables', fn(Blueprint $t) => $t->unique('name'));
    Schema::table('employees', fn(Blueprint $t) => $t->unique('employee_code'));
    Schema::table('promotions', fn(Blueprint $t) => $t->unique('code'));
    Schema::table('products', fn(Blueprint $t) => $t->unique('sku'));
    foreach (array_reverse($this->tables) as $table) {
      Schema::table($table, function (Blueprint $t) use ($table) {
        $t->dropIndex($table . '_store_idx');
        $t->dropConstrainedForeignId('store_id');
      });
    }
  }
};
