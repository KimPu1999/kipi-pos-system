<?php
return [
  'default' => env('MAIL_MAILER', 'log'),
  'mailers' => [
    'smtp' => [
      'transport' => 'smtp',
      'scheme' => env('MAIL_SCHEME'),
      'host' => env('MAIL_HOST', '127.0.0.1'),
      'port' => env('MAIL_PORT', 587),
      'username' => env('MAIL_USERNAME'),
      'password' => env('MAIL_PASSWORD'),
      'timeout' => 10,
    ],
    'log' => ['transport' => 'log'],
    'array' => ['transport' => 'array'],
  ],
  'from' => [
    'address' => env('MAIL_FROM_ADDRESS', 'orders@example.com'),
    'name' => env('MAIL_FROM_NAME', 'Kipi POS'),
  ],
  'order_enabled' => (bool) env('ORDER_EMAIL_ENABLED', false),
  'store_address' => env('ORDER_ADMIN_EMAIL'),
  'store_url' => env('FRONTEND_URL', 'http://localhost:5173'),
];
