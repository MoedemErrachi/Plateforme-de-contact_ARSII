import { describe, expect, it } from 'vitest';
import { csvCell } from '../../src/utils/csv';

describe('csvCell', () => {
  it('wraps a plain string in quotes', () => {
    expect(csvCell('Alice')).toBe('"Alice"');
  });

  it('returns an empty quoted cell for null and undefined', () => {
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
  });

  it('escapes embedded double quotes', () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it('serializes numbers through the value path', () => {
    expect(csvCell(42)).toBe('"42"');
  });

  it('keeps object values readable as JSON instead of [object Object]', () => {
    const obj = { firstName: 'Alice', city: 'Dakar' };
    const cell = csvCell(obj);
    // inner = contenu entre guillemets extérieurs, avec l'échappement CSV inversé
    const inner = cell.slice(1, -1).replaceAll('""', '"');
    expect(inner).toBe(JSON.stringify(obj));
    expect(JSON.parse(inner)).toEqual(obj);
    expect(cell.startsWith('"') && cell.endsWith('"')).toBe(true);
  });
});