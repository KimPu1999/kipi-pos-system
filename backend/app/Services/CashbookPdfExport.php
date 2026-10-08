<?php
namespace App\Services;

class CashbookPdfExport
{
  public static function create(array $summary, array $entries): string
  {
    $pages = [];
    $chunks = array_chunk($entries, 20);
    if (!$chunks) {
      $chunks = [[]];
    }
    foreach ($chunks as $pageIndex => $chunk) {
      $pages[] = self::page($summary, $chunk, $pageIndex + 1, count($chunks));
    }
    $objects = [];
    $objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    $objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
    $objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
    $kids = [];
    $next = 5;
    foreach ($pages as $content) {
      $pageId = $next++;
      $contentId = $next++;
      $kids[] = $pageId . ' 0 R';
      $objects[$pageId] =
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' .
        $contentId .
        ' 0 R >>';
      $objects[$contentId] =
        '<< /Length ' . strlen($content) . ' >>' . "\nstream\n" . $content . "\nendstream";
    }
    $objects[2] =
      '<< /Type /Pages /Kids [' . implode(' ', $kids) . '] /Count ' . count($kids) . ' >>';
    ksort($objects);
    $pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
    $offsets = [0];
    foreach ($objects as $id => $object) {
      $offsets[$id] = strlen($pdf);
      $pdf .= $id . " 0 obj\n" . $object . "\nendobj\n";
    }
    $xref = strlen($pdf);
    $pdf .= "xref\n0 " . (count($objects) + 1) . "\n0000000000 65535 f \n";
    for ($i = 1; $i <= count($objects); $i++) {
      $pdf .= sprintf("%010d 00000 n \n", $offsets[$i]);
    }
    $pdf .=
      'trailer << /Size ' .
      (count($objects) + 1) .
      ' /Root 1 0 R >>' .
      "\nstartxref\n" .
      $xref .
      "\n%%EOF";
    $path = tempnam(sys_get_temp_dir(), 'kipi-cashbook-');
    file_put_contents($path, $pdf);
    return $path;
  }
  private static function page(array $summary, array $rows, int $page, int $total): string
  {
    $c =
      "0.71 0.25 0 rg\n40 548 762 30 re f\n" .
      self::text('Kipi POS - Cashbook report', 52, 558, 18, true, true) .
      self::text(
        'Generated: ' . date('Y-m-d H:i:s') . '  |  Page ' . $page . ' of ' . $total,
        600,
        559,
        9,
        false,
        true,
      );
    $x = 40;
    foreach ($summary as $label => $value) {
      $c .=
        "0.96 0.96 0.96 rg\n$x 500 181 36 re f\n0.75 0.75 0.75 RG\n$x 500 181 36 re S\n" .
        self::text($label, $x + 8, 520, 8, true) .
        self::text($value, $x + 8, 506, 11, true);
      $x += 194;
    }
    $headers = ['Date', 'Type', 'Payment', 'Category', 'Reference', 'Recorded by', 'Amount MMK'];
    $widths = [68, 58, 62, 150, 115, 125, 120];
    $y = 474;
    $c .= "0.18 0.20 0.24 rg\n40 " . ($y - 4) . " 762 22 re f\n";
    $x = 40;
    foreach ($headers as $i => $header) {
      $c .= self::text($header, $x + 4, $y + 3, 8, true, true);
      $x += $widths[$i];
    }
    $y -= 23;
    foreach ($rows as $rowIndex => $row) {
      $c .=
        ($rowIndex % 2 === 0 ? "0.97 0.97 0.97 rg\n40 " . ($y - 3) . " 762 20 re f\n" : '') .
        "0.82 0.82 0.82 RG\n40 " .
        ($y - 3) .
        " 762 20 re S\n";
      $values = [
        $row->entry_date,
        $row->type === 'in' ? 'Cash in' : 'Cash out',
        ucfirst($row->payment_status),
        $row->category,
        $row->reference ?? '-',
        $row->recorded_by ?? 'Admin',
        number_format($row->amount_cents / 100, 0),
      ];
      $x = 40;
      foreach ($values as $i => $value) {
        $limit = [12, 10, 10, 25, 19, 20, 18][$i];
        $c .= self::text(self::short((string) $value, $limit), $x + 4, $y + 3, 8, $i === 6);
        $x += $widths[$i];
      }
      $y -= 21;
    }
    if (!$rows) {
      $c .= self::text('No cash entries found.', 40, 445, 10);
    }
    $c .=
      self::text('Kipi POS cashbook - amounts shown in MMK', 40, 22, 8) .
      self::text('Confidential admin report', 680, 22, 8);
    return $c;
  }
  private static function text(
    string $text,
    float $x,
    float $y,
    int $size,
    bool $bold = false,
    bool $white = false,
  ): string {
    return ($white ? '1 1 1 rg' : '0.08 0.09 0.11 rg') .
      "\nBT /F" .
      ($bold ? '2' : '1') .
      " $size Tf $x $y Td (" .
      self::escape($text) .
      ") Tj ET\n";
  }
  private static function short(string $value, int $limit): string
  {
    $value = preg_replace('/\s+/u', ' ', trim($value));
    return mb_strlen($value) > $limit ? mb_substr($value, 0, $limit - 3) . '...' : $value;
  }
  private static function escape(string $value): string
  {
    $encoded = iconv('UTF-8', 'Windows-1252//TRANSLIT//IGNORE', $value);
    return str_replace(
      ['\\', '(', ')', "\r", "\n"],
      ['\\\\', '\(', '\)', ' ', ' '],
      $encoded === false ? '' : $encoded,
    );
  }
}
