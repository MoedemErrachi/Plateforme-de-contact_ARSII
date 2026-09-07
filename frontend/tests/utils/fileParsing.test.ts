import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseFile } from '../../src/utils/fileParsing';

function csvFile(name: string, content: string): File {
  return new File([content], name, { type: 'text/csv' });
}

function txtFile(name: string, content: string): File {
  return new File([content], name, { type: 'text/plain' });
}

function jsonFile(name: string, content: string): File {
  const file = new File([content], name, { type: 'application/json' });
  Object.defineProperty(file, 'text', { value: async () => content, configurable: true });
  return file;
}

function excelFile(name: string): File {
  const file = new File(['binary-blob'], name, { type: 'application/vnd.ms-excel' });
  Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(8), configurable: true });
  return file;
}

function oversizedFile(name: string, size: number): File {
  return new File([new ArrayBuffer(size)], name, { type: 'text/csv' });
}

describe('parseFile', () => {
  it('parses a basic CSV file into headers and rows', async () => {
    const file = csvFile('contacts.csv', 'Nom,Prénom,Email\nDupont,Jean,jean@x.fr\nMartin,Paul,paul@x.fr');
    const result = await parseFile(file);
    expect(result.format).toBe('csv');
    expect(result.headers).toEqual(['Nom', 'Prénom', 'Email']);
    expect(result.rows).toEqual([
      { rowIndex: 2, originalData: { Nom: 'Dupont', Prénom: 'Jean', Email: 'jean@x.fr' } },
      { rowIndex: 3, originalData: { Nom: 'Martin', Prénom: 'Paul', Email: 'paul@x.fr' } }
    ]);
    expect(result.headerRowIndex).toBe(0);
    expect(result.sheetCount).toBe(1);
  });

  it('uses the file name as the sheet name for CSV', async () => {
    const file = csvFile('mes_contacts.csv', 'A,B\na,b');
    const result = await parseFile(file);
    expect(result.sheetName).toBe('mes_contacts.csv');
  });

  it('parses .txt files as CSV too', async () => {
    const file = txtFile('data.txt', 'A,B\nx,y');
    const result = await parseFile(file);
    expect(result.format).toBe('csv');
    expect(result.headers).toEqual(['A', 'B']);
    expect(result.rows).toHaveLength(1);
  });

  it('fills unnamed headers with Colonne_N and deduplicates repeated headers', async () => {
    const file = csvFile('c.csv', ',A,A\n1,2,3');
    const result = await parseFile(file);
    expect(result.headers).toEqual(['Colonne_1', 'A', 'A_2']);
  });

  it('lets PapaParse skip fully empty rows (greedy)', async () => {
    const file = csvFile('c.csv', 'A,B\n1,2\n,\n3,4');
    const result = await parseFile(file);
    expect(result.rows.map(r => r.rowIndex)).toEqual([2, 3]);
  });

  it('parses a JSON array of objects into headers and rows', async () => {
    const file = jsonFile('c.json', JSON.stringify([{ Nom: 'Dupont', Email: 'd@x.fr' }, { Nom: 'Martin' }]));
    const result = await parseFile(file);
    expect(result.format).toBe('json');
    expect(result.headers).toEqual(expect.arrayContaining(['Nom', 'Email']));
    expect(result.rows).toHaveLength(2);
    expect(result.sheetName).toBe('c.json');
  });

  it('parses a JSON object wrapping a records array', async () => {
    const file = jsonFile('c.json', JSON.stringify({ contacts: [{ A: '1' }, { A: '2' }] }));
    const result = await parseFile(file);
    expect(result.headers).toEqual(['A']);
    expect(result.rows).toHaveLength(2);
  });

  it('throws a friendly error for malformed JSON', async () => {
    const file = jsonFile('bad.json', '{nope');
    await expect(parseFile(file)).rejects.toThrow('JSON malformé');
  });

  it('throws a friendly error when the JSON structure is unrecognised', async () => {
    const file = jsonFile('bad.json', JSON.stringify({ foo: 'bar' }));
    await expect(parseFile(file)).rejects.toThrow('Structure JSON non reconnue');
  });

  it('throws a friendly error for unsupported formats', async () => {
    const file = csvFile('data.pdf', 'x');
    await expect(parseFile(file)).rejects.toThrow('Format non supporté');
  });

  it('throws when the file exceeds the 10 MB limit', async () => {
    const file = oversizedFile('big.csv', 10 * 1024 * 1024 + 1);
    await expect(parseFile(file)).rejects.toThrow('Fichier trop volumineux');
  });

  it('throws when the file has fewer than a header + 1 data row', async () => {
    const file = csvFile('empty.csv', 'A,B');
    await expect(parseFile(file)).rejects.toThrow('pas assez de données');
  });

  it('throws when no valid data row remains', async () => {
    const file = csvFile('empty.csv', 'A,B\n1,2');
    const result = await parseFile(file);
    expect(result.rows).toHaveLength(1);
  });
});

describe('parseFile with Excel engines (mocked)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('parses .xlsx via the ExcelJS engine and detects the header row', async () => {
    const rowValues = [
      [], [], [],
      ['Rapport'],
      ['Nom', 'Email'],
      ['Dupont', 'd@x.fr'],
    ];
    const ws = {
      name: 'Feuil1',
      eachRow(_opts, cb: any) {
        rowValues.forEach((vals, i) => cb({
          get values() {
            return [null, ...vals];
          }
        }));
      }
    };
    const workbook = {
      worksheets: [ws, { name: 'Feuil2' }],
      xlsx: { load: vi.fn().mockResolvedValue(undefined) }
    };
    vi.doMock('exceljs', () => ({ default: { Workbook: vi.fn(() => workbook) } }));

    const { parseFile: pf } = await import('../../src/utils/fileParsing');
    const result = await pf(excelFile('data.xlsx'));

    expect(result.format).toBe('xlsx');
    expect(result.sheetName).toBe('Feuil1');
    expect(result.sheetCount).toBe(2);
    expect(result.headers).toEqual(['Nom', 'Email']);
    expect(result.rows).toEqual([{ rowIndex: 6, originalData: { Nom: 'Dupont', Email: 'd@x.fr' } }]);
  });

  it('throws a friendly error when an Excel file has no worksheet', async () => {
    const workbook = { worksheets: [], xlsx: { load: vi.fn().mockResolvedValue(undefined) } };
    vi.doMock('exceljs', () => ({ default: { Workbook: vi.fn(() => workbook) } }));

    const { parseFile: pf } = await import('../../src/utils/fileParsing');
    await expect(pf(excelFile('data.xlsx'))).rejects.toThrow('Aucune feuille de calcul');
  });

  it('parses .xls via the SheetJS engine', async () => {
    const workbook = {
      SheetNames: ['Feuil1', 'Feuil2'],
      Sheets: { Feuil1: {} },
      utils: {
        sheet_to_json: vi.fn(() => [['Nom', 'Email'], ['Dupont', 'd@x.fr']])
      }
    };
    vi.doMock('xlsx', () => ({ read: vi.fn(() => workbook), utils: workbook.utils }));

    const { parseFile: pf } = await import('../../src/utils/fileParsing');
    const result = await pf(excelFile('data.xls'));

    expect(result.format).toBe('xls');
    expect(result.sheetCount).toBe(2);
    expect(result.sheetName).toBe('Feuil1');
    expect(result.headers).toEqual(['Nom', 'Email']);
    expect(result.rows).toEqual([{ rowIndex: 2, originalData: { Nom: 'Dupont', Email: 'd@x.fr' } }]);
  });
});