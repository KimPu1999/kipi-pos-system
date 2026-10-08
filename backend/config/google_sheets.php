<?php
return [
  'enabled' => (bool) env('GOOGLE_SHEETS_ENABLED', false),
  'spreadsheet_id' => env('GOOGLE_SHEETS_SPREADSHEET_ID'),
  'credentials' =>
    env('GOOGLE_SHEETS_CREDENTIALS_PATH') ?:
    storage_path('app/private/google/service-account.json'),
];
