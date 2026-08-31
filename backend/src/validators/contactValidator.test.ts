import { describe, expect, it } from 'vitest';
import {
  createContactSchema,
  queryContactSchema,
  importContactsSchema,
  bulkDeleteContactsSchema,
} from './contactValidator';

describe('createContactSchema', () => {
  it('accepts a valid contact body', () => {
    const result = createContactSchema.safeParse({
      body: { firstName: 'Alice', email: 'alice@test.com' },
    });
    expect(result.success).toBe(true);
  });

  it('accepts a body with only an email', () => {
    const result = createContactSchema.safeParse({
      body: { email: 'bob@test.com' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects when body is empty (missing required email)', () => {
    const result = createContactSchema.safeParse({
      body: { city: 'Paris' },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(i => i.path.includes('email'))).toBe(true);
    }
  });

  it('rejects an invalid email', () => {
    const result = createContactSchema.safeParse({
      body: { email: 'not-an-email' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid gender', () => {
    const result = createContactSchema.safeParse({
      body: { email: 'a@b.com', gender: 'UNKNOWN' },
    });
    expect(result.success).toBe(false);
  });
});

describe('queryContactSchema', () => {
  it('accepts no query params', () => {
    expect(queryContactSchema.safeParse({ query: {} }).success).toBe(true);
  });

  it('accepts valid page and limit', () => {
    const result = queryContactSchema.safeParse({ query: { page: 1, limit: 20 } });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.page).toBe(1);
    }
  });

  it('coerces numeric page/limit', () => {
    const result = queryContactSchema.safeParse({ query: { page: '2', limit: '50' } });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.page).toBe(2);
      expect(result.data.query.limit).toBe(50);
    }
  });

  it('rejects a non-integer limit', () => {
    expect(queryContactSchema.safeParse({ query: { limit: 'abc' } }).success).toBe(false);
  });

  it('accepts an array of genders', () => {
    const result = queryContactSchema.safeParse({ query: { gender: ['MALE', 'FEMALE'] } });
    expect(result.success).toBe(true);
  });
});

describe('importContactsSchema', () => {
  it('accepts a list of valid rows', () => {
    const result = importContactsSchema.safeParse({
      body: {
        rows: [
          { firstName: 'Alice', email: 'alice@test.com' },
          { lastName: 'B', email: 'b@test.com' },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects when no rows are provided', () => {
    const result = importContactsSchema.safeParse({ body: { rows: [] } });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid email in a row', () => {
    const result = importContactsSchema.safeParse({
      body: { rows: [{ email: 'bad-email' }] },
    });
    expect(result.success).toBe(false);
  });

  it('treats empty-string first/last names as optional', () => {
    const result = importContactsSchema.safeParse({
      body: { rows: [{ firstName: '', email: 'c@test.com' }] },
    });
    expect(result.success).toBe(true);
  });
});

describe('bulkDeleteContactsSchema', () => {
  it('accepts a non-empty id list', () => {
    const result = bulkDeleteContactsSchema.safeParse({ body: { ids: ['1', '2'] } });
    expect(result.success).toBe(true);
  });

  it('rejects an empty id list', () => {
    expect(bulkDeleteContactsSchema.safeParse({ body: { ids: [] } }).success).toBe(false);
  });

  it('rejects a missing ids field', () => {
    expect(bulkDeleteContactsSchema.safeParse({ body: {} }).success).toBe(false);
  });
});
