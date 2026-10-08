<?php
namespace App\Services;
class ExcelExport
{
  public static function create(array $sheets): string
  {
    $path = tempnam(sys_get_temp_dir(), 'kipi-export-');
    $zip = new \ZipArchive();
    if ($zip->open($path, \ZipArchive::OVERWRITE) !== true) {
      throw new \RuntimeException('Cannot create Excel export.');
    }
    try {
      $types =
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>';
      $book =
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>';
      $rels =
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
      $n = 0;
      foreach ($sheets as $name => $rows) {
        $n++;
        $book .=
          '<sheet name="' . self::escape($name) . '" sheetId="' . $n . '" r:id="rId' . $n . '"/>';
        $rels .=
          '<Relationship Id="rId' .
          $n .
          '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' .
          $n .
          '.xml"/>';
        $types .=
          '<Override PartName="/xl/worksheets/sheet' .
          $n .
          '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
        $cols = count($rows[0]);
        $xml =
          '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="' .
          $cols .
          '" width="24" customWidth="1"/></cols><sheetData>';
        foreach ($rows as $index => $row) {
          $xml .=
            '<row r="' .
            ($index + 1) .
            '"' .
            ($index === 0 ? ' ht="32" customHeight="1"' : '') .
            '>';
          foreach ($row as $c => $value) {
            $ref = self::column($c + 1) . ($index + 1);
            $style = $index === 0 ? 1 : 0;
            if (is_int($value) || is_float($value)) {
              $xml .= '<c r="' . $ref . '" s="' . $style . '"><v>' . $value . '</v></c>';
            } else {
              $xml .=
                '<c r="' .
                $ref .
                '" s="' .
                $style .
                '" t="inlineStr"><is><t xml:space="preserve">' .
                self::escape((string) $value) .
                '</t></is></c>';
            }
          }
          $xml .= '</row>';
        }
        $xml .=
          '</sheetData><autoFilter ref="A1:' .
          self::column($cols) .
          count($rows) .
          '"/></worksheet>';
        $zip->addFromString('xl/worksheets/sheet' . $n . '.xml', $xml);
      }
      $zip->addFromString('[Content_Types].xml', $types . '</Types>');
      $zip->addFromString(
        '_rels/.rels',
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      );
      $zip->addFromString('xl/workbook.xml', $book . '</sheets></workbook>');
      $zip->addFromString(
        'xl/_rels/workbook.xml.rels',
        $rels .
          '<Relationship Id="styles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
      );
      $zip->addFromString(
        'xl/styles.xml',
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFB65300"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf fontId="0" fillId="0" borderId="0" xfId="0"/><xf fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment wrapText="1" vertical="center"/></xf></cellXfs></styleSheet>',
      );
      $zip->close();
      return $path;
    } catch (\Throwable $e) {
      $zip->close();
      @unlink($path);
      throw $e;
    }
  }
  private static function escape(string $s): string
  {
    return htmlspecialchars(
      preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', $s),
      ENT_XML1 | ENT_QUOTES,
      'UTF-8',
    );
  }
  private static function column(int $n): string
  {
    $s = '';
    while ($n > 0) {
      $n--;
      $s = chr(65 + ($n % 26)) . $s;
      $n = intdiv($n, 26);
    }
    return $s;
  }
}
