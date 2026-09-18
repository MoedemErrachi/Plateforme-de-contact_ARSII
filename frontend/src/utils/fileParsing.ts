/**
 * Robust file-parsing module for the contact import wizard.
 *
 * Handles: XLSX (ExcelJS), XLS (SheetJS/xlsx), CSV (PapaParse), JSON.
 * Includes header-row detection for Excel, empty-row skipping, row-length
 * normalisation, and cell-value extraction for hyperlinks / rich text.
 */

import type { RawRowData } from '../components/ImportWizardView';

// ── Public types ─────────────────────────────────────────────────────

export interface ParsedFileData {
  headers: string[];
  rows: RawRowData[];
  headerRowIndex: number; // 0-based
  sheetCount: number;
  sheetName: string;
  format: 'xlsx' | 'xls' | 'csv' | 'json';
}

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// ── Helpers ──────────────────────────────────────────────────────────

/** Extract the URL from a hyperlink cell, stripping a mailto: prefix. */
function extractHyperlink(cell: any): string | null {
  const link = cell?.hyperlink;
  if (typeof link !== 'string') return null;
  return link.startsWith('mailto:') ? link.slice(7).trim() : link;
}

/** Join rich-text fragments (both { text: { richText } } and direct richText). */
function extractRichText(cell: any): string | null {
  const rt = cell?.richText;
  if (Array.isArray(rt)) return rt.map((frag: any) => frag?.text || '').join('');
  return null;
}

/** Extract a plain string from any ExcelJS / SheetJS cell value. */
function cellToString(cell: any): string {
  if (cell === null || cell === undefined) return '';
  if (cell instanceof Date) return cell.toLocaleDateString('fr-FR');
  if (typeof cell === 'object') {
    // Hyperlink (mailto:)
    const link = extractHyperlink(cell);
    if (link !== null) return link;
    // Rich text { text: { richText: [...] } }
    const text = cell?.text;
    if (typeof text === 'string') return text;
    if (text && typeof text === 'object' && Array.isArray(text.richText)) {
      return text.richText.map((frag: any) => frag?.text || '').join('');
    }
    // Direct richText array / formula result
    const rich = extractRichText(cell);
    if (rich !== null) return rich;
    if ('result' in cell) return cell.result ?? '';
  }
  return String(cell);
}

/** Check whether a row is entirely empty. */
function isEmptyRow(rowArr: any[]): boolean {
  return !rowArr || rowArr.every(cell => cell === null || cell === undefined || String(cell).trim() === '');
}

/** Score a single cell as header material (positive = more likely a header). */
function cellHeaderScore(cell: any): number {
  const s = cellToString(cell);
  if (!s) return -2; // empty cell penalised
  let score = 3; // non-empty string cell
  // Date-like values should NOT be in a header
  if (/^\d{1,4}[./-]\d{1,4}[./-]\d{1,4}/.test(s)) score -= 2;
  // Purely numeric values are data, not headers
  if (/^\d+(\.\d+)?$/.test(s)) score -= 1;
  return score;
}

/**
 * Detect which row is most likely the header row.
 * Only used for Excel files where metadata rows may precede the actual header.
 */
function detectHeaderRow(rows: any[][]): number {
  const maxScan = Math.min(rows.length, 10);
  let bestIdx = 0;
  let bestScore = -1;

  for (let r = 0; r < maxScan; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    let score = 0;
    for (const cell of row) score += cellHeaderScore(cell);

    if (score > bestScore) {
      bestScore = score;
      bestIdx = r;
    }
  }

  // Require a minimum score to avoid treating a data-only sheet as having a header
  return bestScore >= 5 ? bestIdx : 0;
}

/**
 * Deduplicate headers by appending _2, _3, etc. for repeated names.
 */
function deduplicateHeaders(headers: string[]): string[] {
  const counts: Record<string, number> = {};
  return headers.map(h => {
    const key = h.toLowerCase();
    counts[key] = (counts[key] || 0) + 1;
    return counts[key] > 1 ? `${h}_${counts[key]}` : h;
  });
}

// ── XLSX (ExcelJS) ──────────────────────────────────────────────────

async function parseXLSX(file: File): Promise<{ matrix: any[][]; sheetCount: number; sheetName: string }> {
  const ExcelJS = (await import('exceljs')).default;
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await (workbook.xlsx as any).load(arrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('Aucune feuille de calcul trouvée.');

  const matrix: any[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const rowValues = Array.isArray(row.values) ? row.values.slice(1) : [];
    matrix.push(rowValues.map(cellToString));
  });

  return { matrix, sheetCount: workbook.worksheets.length, sheetName: worksheet.name };
}

// ── XLS (SheetJS) ───────────────────────────────────────────────────

async function parseXLS(file: File): Promise<{ matrix: any[][]; sheetCount: number; sheetName: string }> {
  const XLSX = await import('xlsx');
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('Aucune feuille de calcul trouvée.');

  const sheet = workbook.Sheets[sheetName];
  const raw: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  return {
    matrix: raw.map(row => (Array.isArray(row) ? row.map(cellToString) : [])),
    sheetCount: workbook.SheetNames.length,
    sheetName,
  };
}

// ── CSV (PapaParse) ─────────────────────────────────────────────────

async function parseCSV(file: File): Promise<{ matrix: any[][] }> {
  const Papa = (await import('papaparse')).default;
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      skipEmptyLines: 'greedy',
      complete: (results) => {
        if (results.errors.length > 0 && results.data.length === 0) {
          reject(new Error('Impossible de lire le fichier CSV.'));
          return;
        }
        resolve({ matrix: results.data as any[][] });
      },
      error: () => reject(new Error('Erreur lors de la lecture du fichier CSV.')),
    });
  });
}

// ── JSON ─────────────────────────────────────────────────────────────

/** Locate the most plausible array of records inside a parsed JSON document. */
function findJsonRecords(parsed: any): Record<string, any>[] | null {
  if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
    return parsed as Record<string, any>[];
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    // Search for first property that is an array of objects
    for (const key of Object.keys(parsed)) {
      const val = parsed[key];
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
        return val as Record<string, any>[];
      }
    }
  }
  return null;
}

function parseJSON(text: string): { matrix: any[][] } {
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('JSON malformé. Veuillez vérifier la syntaxe du fichier.');
  }

  const records = findJsonRecords(parsed);

  if (!records || records.length === 0) {
    throw new Error('Structure JSON non reconnue. Attendu: un tableau d\'objets ou { "contacts": [...] }.');
  }

  // Collect all unique keys across all records (union)
  const keySet = new Set<string>();
  for (const rec of records) {
    for (const k of Object.keys(rec)) {
      keySet.add(k);
    }
  }
  const keys = Array.from(keySet);

  // Build matrix: first row = headers, subsequent rows = data
  const matrix: any[][] = [keys];
  for (const rec of records) {
    const row = keys.map(k => (rec[k] !== undefined && rec[k] !== null ? String(rec[k]) : ''));
    matrix.push(row);
  }

  return { matrix };
}

// ── Main public API ──────────────────────────────────────────────────

export async function parseFile(file: File): Promise<ParsedFileData> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} Mo). La taille maximale autorisée est de 10 Mo.`,
    );
  }

  const nameLower = file.name.toLowerCase();
  let matrix: any[][] = [];
  let sheetCount = 1;
  let sheetName = '';
  let format: ParsedFileData['format'];

  if (nameLower.endsWith('.xlsx')) {
    format = 'xlsx';
    const result = await parseXLSX(file);
    matrix = result.matrix;
    sheetCount = result.sheetCount;
    sheetName = result.sheetName;
  } else if (nameLower.endsWith('.xls')) {
    format = 'xls';
    const result = await parseXLS(file);
    matrix = result.matrix;
    sheetCount = result.sheetCount;
    sheetName = result.sheetName;
  } else if (nameLower.endsWith('.csv') || nameLower.endsWith('.txt')) {
    format = 'csv';
    const result = await parseCSV(file);
    matrix = result.matrix;
    sheetName = file.name;
  } else if (nameLower.endsWith('.json')) {
    format = 'json';
    const text = await file.text();
    const result = parseJSON(text);
    matrix = result.matrix;
    sheetName = file.name;
  } else {
    throw new Error('Format non supporté. Veuillez sélectionner un fichier .csv, .xlsx, .xls ou .json.');
  }

  if (!matrix || matrix.length < 2) {
    throw new Error('Le fichier ne contient pas assez de données (au moins 1 en-tête + 1 ligne de données requis).');
  }

  // Detect header row for Excel (not CSV/JSON — those always have header at row 0)
  const headerRowIndex = (format === 'xlsx' || format === 'xls')
    ? detectHeaderRow(matrix)
    : 0;

  // Extract headers
  const rawHeaders = (matrix[headerRowIndex] || []).map(
    (h: any, i: number) => String(h || '').trim() || `Colonne_${i + 1}`,
  );
  const validHeaders = rawHeaders.filter((h: string) => h.length > 0);

  if (validHeaders.length === 0) {
    throw new Error('Aucun en-tête de colonne trouvé dans le fichier.');
  }

  const dedupedHeaders = deduplicateHeaders(validHeaders);

  // Build raw row objects (skip empty rows, normalise row lengths)
  const dataRows: RawRowData[] = [];

  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const rowArr = matrix[r];
    if (isEmptyRow(rowArr)) continue;

    const rowObj: Record<string, string> = {};
    dedupedHeaders.forEach((h, colIdx) => {
      const raw = rowArr[colIdx];
      rowObj[h] = raw !== undefined && raw !== null ? String(raw).trim() : '';
    });
    dataRows.push({ rowIndex: r + 1, originalData: rowObj });
  }

  if (dataRows.length === 0) {
    throw new Error('Le fichier ne contient aucune ligne de données valide.');
  }

  return {
    headers: dedupedHeaders,
    rows: dataRows,
    headerRowIndex,
    sheetCount,
    sheetName: sheetName || file.name,
    format,
  };
}


