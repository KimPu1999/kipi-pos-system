<?php
use App\Http\Controllers\AuthController;
use App\Http\Controllers\PosController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
Route::middleware('web')->group(function () {
  Route::get('/settings', [\App\Http\Controllers\SettingsController::class, 'index']);
  Route::get('/auth/csrf', fn() => response()->json(['token' => csrf_token()]));
  Route::post('/auth/register', [AuthController::class, 'register'])->middleware('throttle:10,1');
  Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
  Route::middleware('auth')->group(function () {
    Route::get('/auth/user', fn(Request $request) => response()->json($request->user()));
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/products', [PosController::class, 'products'])->middleware(
      \App\Http\Middleware\AdminOnly::class,
    );
    Route::get('/products/{id}/image', [
      \App\Http\Controllers\ProductImageController::class,
      'show',
    ]);
    Route::get('/promotions/{id}/image', [
      \App\Http\Controllers\PromotionController::class,
      'image',
    ]);
    Route::get('/promotions', [\App\Http\Controllers\PromotionController::class, 'index']);
    Route::get(
      '/available-tables',
      fn() => response()->json(
        \Illuminate\Support\Facades\DB::table('dining_tables')
          ->where('status', 'available')
          ->orderBy('id')
          ->get(['id', 'name', 'seats', 'area']),
      ),
    );
    Route::get('/table-choices', [\App\Http\Controllers\DiningTableController::class, 'choices']);
    Route::get('/catalog', [\App\Http\Controllers\PortalController::class, 'catalog']);
    Route::get('/wishlist', [\App\Http\Controllers\WishlistController::class, 'index']);
    Route::get('/wishlist/notifications', [
      \App\Http\Controllers\WishlistNotificationController::class,
      'index',
    ]);
    Route::post('/wishlist/notifications/read', [
      \App\Http\Controllers\WishlistNotificationController::class,
      'read',
    ]);
    Route::post('/wishlist/{product}', [\App\Http\Controllers\WishlistController::class, 'store']);
    Route::delete('/wishlist/{product}', [
      \App\Http\Controllers\WishlistController::class,
      'destroy',
    ]);
    Route::get('/customer/rewards', [
      \App\Http\Controllers\CustomerRewardsController::class,
      'index',
    ]);
    Route::get('/announcements', [\App\Http\Controllers\AnnouncementController::class, 'index']);
    Route::post('/announcements/{id}/read', [
      \App\Http\Controllers\AnnouncementController::class,
      'read',
    ]);
    Route::get('/orders', [\App\Http\Controllers\PortalController::class, 'orders']);
    Route::post('/orders', [\App\Http\Controllers\PortalController::class, 'placeOrder']);
    Route::put('/orders/{id}', [\App\Http\Controllers\PortalController::class, 'editOrder']);
    Route::post('/orders/{id}/confirm', [
      \App\Http\Controllers\PortalController::class,
      'customerConfirm',
    ]);
    Route::patch('/orders/{id}', [\App\Http\Controllers\PortalController::class, 'updateOrder']);
    Route::middleware(\App\Http\Middleware\AdminOnly::class)->group(function () {
      Route::post('/promotions/{id}/image', [
        \App\Http\Controllers\PromotionController::class,
        'uploadImage',
      ]);
      Route::post('/promotions', [\App\Http\Controllers\PromotionController::class, 'store']);
      Route::put('/promotions/{id}', [\App\Http\Controllers\PromotionController::class, 'update']);
      Route::delete('/promotions/{id}', [
        \App\Http\Controllers\PromotionController::class,
        'destroy',
      ]);
      Route::patch('/promotions/{id}', [
        \App\Http\Controllers\PromotionController::class,
        'toggle',
      ]);
      Route::post('/products', [PosController::class, 'storeProduct']);
      Route::put('/table-areas', [
        \App\Http\Controllers\DiningTableController::class,
        'renameArea',
      ]);
      Route::delete('/table-areas', [
        \App\Http\Controllers\DiningTableController::class,
        'deleteArea',
      ]);
      Route::put('/settings', [\App\Http\Controllers\SettingsController::class, 'update']);
      Route::get('/settings/system', [\App\Http\Controllers\SettingsController::class, 'info']);
      Route::get('/dining-tables', [\App\Http\Controllers\DiningTableController::class, 'index']);
      Route::post('/dining-tables/bulk', [
        \App\Http\Controllers\DiningTableController::class,
        'bulk',
      ]);
      Route::post('/dining-tables', [\App\Http\Controllers\DiningTableController::class, 'store']);
      Route::put('/dining-tables/{id}', [
        \App\Http\Controllers\DiningTableController::class,
        'update',
      ]);
      Route::delete('/dining-tables/{id}', [
        \App\Http\Controllers\DiningTableController::class,
        'destroy',
      ]);
      Route::get('/employees', [\App\Http\Controllers\EmployeeController::class, 'index']);
      Route::get('/notes', [\App\Http\Controllers\NoteController::class, 'index']);
      Route::put('/admin/customers/{id}', [
        \App\Http\Controllers\AdminCustomerController::class,
        'update',
      ]);
      Route::delete('/admin/customers/{id}', [
        \App\Http\Controllers\AdminCustomerController::class,
        'destroy',
      ]);
      Route::post('/announcements', [\App\Http\Controllers\AnnouncementController::class, 'store']);
      Route::delete('/announcements/{id}', [
        \App\Http\Controllers\AnnouncementController::class,
        'destroy',
      ]);
      Route::post('/notes', [\App\Http\Controllers\NoteController::class, 'store']);
      Route::get('/notes/{id}/file', [\App\Http\Controllers\NoteController::class, 'download']);
      Route::post('/notes/{id}', [\App\Http\Controllers\NoteController::class, 'update']);
      Route::put('/notes/{id}', [\App\Http\Controllers\NoteController::class, 'update']);
      Route::delete('/notes/{id}', [\App\Http\Controllers\NoteController::class, 'destroy']);
      Route::get('/employees/export-pdf', [
        \App\Http\Controllers\EmployeeController::class,
        'exportPdf',
      ]);
      Route::post('/employees', [\App\Http\Controllers\EmployeeController::class, 'store']);
      Route::put('/employees/{id}', [\App\Http\Controllers\EmployeeController::class, 'update']);

      Route::delete('/employees/{id}', [\App\Http\Controllers\EmployeeController::class, 'destroy']);
      Route::post('/employees/{id}/check-in', [
        \App\Http\Controllers\EmployeeController::class,
        'checkIn',
      ]);
      Route::post('/employees/{id}/check-out', [
        \App\Http\Controllers\EmployeeController::class,
        'checkOut',
      ]);
      Route::post('/employees/{id}/shifts', [
        \App\Http\Controllers\EmployeeController::class,
        'shift',
      ]);
      Route::post('/employees/{id}/salary-payments', [
        \App\Http\Controllers\EmployeeController::class,
        'paySalary',
      ]);
      Route::put('/employees/{id}/salary-payments/{paymentId}', [
        \App\Http\Controllers\EmployeeController::class,
        'updateSalaryPayment',
      ]);
      Route::put('/employee-shifts/{id}', [
        \App\Http\Controllers\EmployeeController::class,
        'updateShift',
      ]);
      Route::delete('/employee-shifts/{id}', [
        \App\Http\Controllers\EmployeeController::class,
        'deleteShift',
      ]);
      Route::get('/purchases', [\App\Http\Controllers\PurchaseController::class, 'index']);
      Route::put('/purchases/{id}', [\App\Http\Controllers\PurchaseController::class, 'update']);
      Route::post('/purchases/{id}/payment', [
        \App\Http\Controllers\PurchaseController::class,
        'pay',
      ]);
      Route::post('/purchases', [\App\Http\Controllers\PurchaseController::class, 'store']);
      Route::get('/cash-entries', [\App\Http\Controllers\CashEntryController::class, 'index']);
      Route::get('/cash-entries/export', [
        \App\Http\Controllers\CashEntryController::class,
        'export',
      ]);
      Route::get('/cash-entries/export-pdf', [
        \App\Http\Controllers\CashEntryController::class,
        'exportPdf',
      ]);
      Route::post('/cash-entries', [\App\Http\Controllers\CashEntryController::class, 'store']);
      Route::put('/cash-entries/{id}', [
        \App\Http\Controllers\CashEntryController::class,
        'update',
      ]);
      Route::post('/cash-entries/{id}/payment', [
        \App\Http\Controllers\CashEntryController::class,
        'pay',
      ]);
      Route::delete('/cash-entries/{id}', [
        \App\Http\Controllers\CashEntryController::class,
        'destroy',
      ]);
      Route::get('/sales', [PosController::class, 'sales']);
      Route::post('/sales', [PosController::class, 'checkout']);
      Route::patch('/orders/{id}/delivery', [
        \App\Http\Controllers\PortalController::class,
        'delivery',
      ]);
      Route::get('/admin/export', [\App\Http\Controllers\ExportController::class, 'download']);
      Route::get('/admin/reports', [\App\Http\Controllers\ReportController::class, 'index']);
      Route::get('/admin/dashboard', [\App\Http\Controllers\PortalController::class, 'dashboard']);
      Route::patch('/products/{id}/stock', [
        \App\Http\Controllers\PortalController::class,
        'updateStock',
      ]);
      Route::patch('/products/{id}/active', [
        \App\Http\Controllers\PortalController::class,
        'setProductActive',
      ]);
      Route::put('/products/{id}', [
        \App\Http\Controllers\PortalController::class,
        'updateProduct',
      ]);
      Route::delete('/products/{id}/permanent', [
        \App\Http\Controllers\PortalController::class,
        'deleteProduct',
      ]);
      Route::delete('/products/{id}', [
        \App\Http\Controllers\PortalController::class,
        'archiveProduct',
      ]);
    });
  });
});
