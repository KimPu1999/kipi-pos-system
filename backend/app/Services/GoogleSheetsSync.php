<?php
namespace App\Services;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;
class GoogleSheetsSync
{
  public function run(): int
  {
    if (!config('google_sheets.enabled')) {
      throw new \RuntimeException('Google Sheets sync is disabled. Configure backend/.env first.');
    }
    $id = config('google_sheets.spreadsheet_id');
    if (!$id || !preg_match('/^[A-Za-z0-9_-]+$/', $id)) {
      throw new \RuntimeException('Set a valid GOOGLE_SHEETS_SPREADSHEET_ID.');
    }
    return Cache::lock('kipi-google-sheets-sync', 300)->block(1, function () use ($id) {
      $path = config('google_sheets.credentials');
      if (!is_readable($path)) {
        throw new \RuntimeException('Service-account credential file is missing or unreadable.');
      }
      $credentials = json_decode(file_get_contents($path), true);
      if (
        ($credentials['type'] ?? '') !== 'service_account' ||
        empty($credentials['client_email']) ||
        empty($credentials['private_key'])
      ) {
        throw new \RuntimeException('Invalid service-account credential file.');
      }
      $encode = fn($s) => rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
      $now = time();
      $jwt =
        $encode(json_encode(['alg' => 'RS256', 'typ' => 'JWT'])) .
        '.' .
        $encode(
          json_encode([
            'iss' => $credentials['client_email'],
            'scope' => 'https://www.googleapis.com/auth/spreadsheets',
            'aud' => 'https://oauth2.googleapis.com/token',
            'iat' => $now,
            'exp' => $now + 3600,
          ]),
        );
      if (!openssl_sign($jwt, $signature, $credentials['private_key'], OPENSSL_ALGO_SHA256)) {
        throw new \RuntimeException('Cannot sign Google authentication request.');
      }
      $auth = Http::asForm()
        ->timeout(20)
        ->post('https://oauth2.googleapis.com/token', [
          'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          'assertion' => $jwt . '.' . $encode($signature),
        ]);
      if (!$auth->successful() || !$auth->json('access_token')) {
        throw new \RuntimeException(
          'Google authentication failed. Check service-account credentials.',
        );
      }
      $http = Http::withToken($auth->json('access_token'))->timeout(30);
      $base = 'https://sheets.googleapis.com/v4/spreadsheets/' . $id;
      $response = $http->get($base, ['fields' => 'sheets.properties']);
      $this->check($response);
      $titles = array_column(array_column($response->json('sheets') ?? [], 'properties'), 'title');
      $definitions = [
        'Kipi Orders' => [
          'orders',
          [
            'id',
            'user_id',
            'status',
            'service_type',
            'table_name',
            'total_cents',
            'discount_cents',
            'customer_confirmed_at',
            'confirmed_at',
            'created_at',
          ],
        ],
        'Kipi Receipts' => [
          'sales',
          [
            'id',
            'service_type',
            'table_name',
            'total_cents',
            'discount_cents',
            'payment_method',
            'amount_received_cents',
            'change_cents',
            'created_at',
          ],
        ],
        'Kipi Order Items' => [
          'order_items',
          ['id', 'order_id', 'product_id', 'name', 'quantity', 'price_cents'],
        ],
        'Kipi Receipt Items' => [
          'sale_items',
          ['id', 'sale_id', 'product_id', 'name', 'quantity', 'price_cents'],
        ],
        'Kipi Inventory' => [
          'products',
          ['id', 'name', 'sku', 'category', 'stock', 'active', 'price_cents'],
        ],
      ];
      $requests = [];
      foreach ($definitions as $title => $definition) {
        if (!in_array($title, $titles)) {
          $requests[] = [
            'addSheet' => [
              'properties' => [
                'title' => $title,
                'gridProperties' => [
                  'rowCount' => 1000,
                  'columnCount' => 20,
                  'frozenRowCount' => 1,
                ],
              ],
            ],
          ];
        }
      }
      if ($requests) {
        $this->check($http->post($base . ':batchUpdate', ['requests' => $requests]));
      }
      $updates = [];
      $count = 0;
      foreach ($definitions as $title => [$table, $columns]) {
        $range = "'" . $title . "'!A1:Z";
        $old = $http->get($base . '/values/' . rawurlencode($range));
        $this->check($old);
        $values = $old->json('values') ?? [];
        $byId = [];
        foreach (array_slice($values, 1) as $row) {
          if (isset($row[0])) {
            $byId[(string) $row[0]] = $row;
          }
        }
        foreach (DB::table($table)->orderBy('id')->get($columns) as $record) {
          $row = [];
          foreach ($columns as $column) {
            $value = $record->$column ?? '';
            if (str_ends_with($column, '_cents') && $value !== '') {
              $value = $value / 100;
            }
            if (str_ends_with($column, '_at') && $value) {
              $value = \Illuminate\Support\Carbon::parse($value, 'UTC')
                ->timezone('Asia/Yangon')
                ->format('Y-m-d H:i:s');
            }
            $row[] = $value;
          }
          $byId[(string) $record->id] = $row;
          $count++;
        }
        $headers = array_map(
          fn($column) => ucwords(str_replace('_', ' ', str_replace('_cents', ' MMK', $column))),
          $columns,
        );
        $rows = [$headers, ...array_values($byId)];
        // Grow each dedicated tab before writing, preserving archived rows.
        $meta = $http->get($base, ['fields' => 'sheets.properties']);
        $this->check($meta);
        foreach ($meta->json('sheets') as $sheet) {
          $prop = $sheet['properties'];
          if (
            $prop['title'] === $title &&
            ($prop['gridProperties']['rowCount'] ?? 0) < count($rows)
          ) {
            $this->check(
              $http->post($base . ':batchUpdate', [
                'requests' => [
                  [
                    'updateSheetProperties' => [
                      'properties' => [
                        'sheetId' => $prop['sheetId'],
                        'gridProperties' => ['rowCount' => count($rows) + 100],
                      ],
                      'fields' => 'gridProperties.rowCount',
                    ],
                  ],
                ],
              ]),
            );
          }
        }
        $updates[] = ['range' => "'" . $title . "'!A1", 'values' => $rows];
      }
      $this->check(
        $http->post($base . '/values:batchUpdate', [
          'valueInputOption' => 'RAW',
          'data' => $updates,
        ]),
      );
      return $count;
    });
  }
  private function check($response): void
  {
    if (!$response->successful()) {
      throw new \RuntimeException(
        'Google Sheets request failed (HTTP ' .
          $response->status() .
          '). Check that the API is enabled and the sheet is shared with the service account as Editor.',
      );
    }
  }
}
