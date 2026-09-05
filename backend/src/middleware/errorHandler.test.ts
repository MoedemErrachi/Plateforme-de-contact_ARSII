import { describe, expect, it, vi, afterEach } from 'vitest';
import { AppError } from '../utils/appError';
import { errorHandler } from './errorHandler';

function buildRes(headersSent = false) {
  return {
    headersSent,
    status: vi.fn().mockReturnThis(),
    json: vi.fn()
  };
}

function invoke(err: unknown, res: ReturnType<typeof buildRes>, env: 'production' | 'development' = 'production') {
  const req: any = { method: 'GET', path: '/api/test' };
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = env;
  try {
    errorHandler(err as any, req, res as any, vi.fn());
  } finally {
    if (originalEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnv;
  }
}

describe('errorHandler', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renvoie le statut et le message d’un AppError 404 sans stack en production', () => {
    const res = buildRes();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    invoke(new AppError('Contact non trouvé', 404), res, 'production');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ status: 'fail', message: 'Contact non trouvé' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('renvoie 400 pour un AppError de statut 4xx', () => {
    const res = buildRes();
    invoke(new AppError('Payload invalide', 400), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ status: 'fail', message: 'Payload invalide' });
  });

  it('inclut la stack en développement', () => {
    const res = buildRes();
    const err = new AppError('Problème', 500);
    invoke(err, res, 'development');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ stack: err.stack }));
  });

  it('journalise et renvoie 500 pour une erreur générique', () => {
    const res = buildRes();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    invoke(new Error('kaboom'), res, 'production');
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ status: 'error', message: 'kaboom' });
    expect(spy).toHaveBeenCalled();
  });

  it('ne touche pas à la réponse si les headers sont déjà envoyés', () => {
    const res = buildRes(true);
    invoke(new Error('boom'), res);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('journalise la stack en local (hors production), même 4xx non loggé hors 5xx', () => {
    const res = buildRes();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    invoke(new AppError('Erreur interne', 500), res, 'development');
    expect(spy).toHaveBeenCalled();
  });
});