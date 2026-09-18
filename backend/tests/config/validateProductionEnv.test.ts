import { describe, expect, it, afterEach } from 'vitest';
import {
  assertProductionEnv,
  getMissingProductionEnvVars
} from '../../src/config/validateProductionEnv';

const originalEnv = process.env.NODE_ENV;
const originalFrontend = process.env.FRONTEND_URL;
const originalCors = process.env.CORS_ORIGINS;

afterEach(() => {
  if (originalEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalEnv;
  if (originalFrontend === undefined) delete process.env.FRONTEND_URL;
  else process.env.FRONTEND_URL = originalFrontend;
  if (originalCors === undefined) delete process.env.CORS_ORIGINS;
  else process.env.CORS_ORIGINS = originalCors;
});

describe('validateProductionEnv', () => {
  it('ne contrôle rien hors production', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.FRONTEND_URL;
    delete process.env.CORS_ORIGINS;
    expect(getMissingProductionEnvVars()).toEqual([]);
    expect(() => assertProductionEnv()).not.toThrow();
  });

  it('liste les variables manquantes en production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.FRONTEND_URL;
    delete process.env.CORS_ORIGINS;
    expect(getMissingProductionEnvVars()).toEqual(['FRONTEND_URL', 'CORS_ORIGINS']);
    expect(() => assertProductionEnv()).toThrow(/FRONTEND_URL/);
    expect(() => assertProductionEnv()).toThrow(/CORS_ORIGINS/);
  });

  it('liste uniquement la variable réellement manquante', () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'https://frontend.example.com';
    delete process.env.CORS_ORIGINS;
    expect(getMissingProductionEnvVars()).toEqual(['CORS_ORIGINS']);
  });

  it('accepte une configuration production complète', () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'https://frontend.example.com';
    process.env.CORS_ORIGINS = 'https://frontend.example.com';
    expect(getMissingProductionEnvVars()).toEqual([]);
    expect(() => assertProductionEnv()).not.toThrow();
  });

  it('rejette une variable vide en production', () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = '';
    process.env.CORS_ORIGINS = 'https://frontend.example.com';
    expect(getMissingProductionEnvVars()).toEqual(['FRONTEND_URL']);
  });
});