<?php
use App\Models\User;
use Illuminate\Support\Facades\Artisan;
Artisan::command('pos:make-admin {email}', function () {
  $user = User::where('email', strtolower(trim($this->argument('email'))))->first();
  if (!$user) {
    $this->error('Register this account first.');
    return 1;
  }
  $user->role = 'admin';
  $user->save();
  $this->info('Administrator access granted. Sign out and sign in again.');
});

\Illuminate\Support\Facades\Artisan::command('pos:send-order-emails', function () {
  if (!config('mail.order_enabled') || config('mail.default') !== 'smtp') {
    $this->warn('Set ORDER_EMAIL_ENABLED=true and configure MAIL_MAILER=smtp first.');
    return;
  }
  $result = \App\Services\OrderEmails::sendPending();
  $this->info("Sent: {$result['sent']}; failed: {$result['failed']}.");
})->purpose('Send pending order notifications (run one worker at a time)');
\Illuminate\Support\Facades\Schedule::command('pos:send-order-emails')
  ->everyMinute()
  ->withoutOverlapping();

Artisan::command('pos:sync-google-sheets', function () {
  try {
    $count = app(\App\Services\GoogleSheetsSync::class)->run();
    $this->info('Google Sheets updated: ' . $count . ' current records.');
    return 0;
  } catch (\Throwable $e) {
    $this->error($e->getMessage());
    return 1;
  }
})->purpose('Sync POS data to dedicated Google Sheets tabs without deleting archived rows');
\Illuminate\Support\Facades\Schedule::command('pos:sync-google-sheets')
  ->everyFiveMinutes()
  ->withoutOverlapping()
  ->when(fn() => config('google_sheets.enabled'));
