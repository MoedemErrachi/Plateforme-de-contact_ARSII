import { describe, expect, it } from 'vitest';
import { AppError } from '../../src/utils/appError';

describe('AppError', () => {
  it('is an instance of Error and AppError', () => {
    const err = new AppError('boom', 400);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });

  it('sets message and statusCode', () => {
    const err = new AppError('boom', 400);
    expect(err.message).toBe('boom');
    expect(err.statusCode).toBe(400);
  });

  it('sets status to "fail" for 4xx codes', () => {
    expect(new AppError('boom', 400).status).toBe('fail');
    expect(new AppError('boom', 404).status).toBe('fail');
  });

  it('sets status to "error" for 5xx codes', () => {
    expect(new AppError('boom', 500).status).toBe('error');
    expect(new AppError('boom', 503).status).toBe('error');
  });

  it('marks the error as operational', () => {
    expect(new AppError('boom', 400).isOperational).toBe(true);
  });
});
