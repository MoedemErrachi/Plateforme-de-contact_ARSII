import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import crypto from 'node:crypto';

// 1. RATE LIMITERS
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: {
    error: 'Trop de tentatives de connexion. Veuillez réessayer dans 15 minutes.',
    code: 'TOO_MANY_REQUESTS'
  }
});

export const globalApiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 500 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: {
    error: 'Limite de requêtes atteinte. Veuillez patienter avant de réessayer.',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

export const importRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 import requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: {
    error: 'Limite de téléversements atteinte (10 max par heure).',
    code: 'IMPORT_LIMIT_EXCEEDED'
  }
});

// 2. HELMET CONFIGURATION
// CSP active UNIQUEMENT en production : en développement, Vite (HMR, scripts
// inline) rendrait la politique inapplicable sans bénéfice réel.
// Directives dérivées de l'environnement :
//  - img-src     : origine Supabase Storage (avatars) ;
//  - connect-src : origines frontend/chatbot déclarées dans CORS_ORIGINS.
function buildProductionCsp() {
  const self = "'self'";
  const imgSrc = [self, 'data:'];
  const connectSrc = [self];

  if (process.env.SUPABASE_URL) {
    try {
      const supabaseOrigin = new URL(process.env.SUPABASE_URL).origin;
      imgSrc.push(supabaseOrigin);
      connectSrc.push(supabaseOrigin);
    } catch {
      // URL invalide : ignorée silencieusement.
    }
  }

  for (const raw of (process.env.CORS_ORIGINS || '').split(',')) {
    const candidate = raw.trim();
    if (!candidate || candidate === '*') continue;
    try {
      connectSrc.push(new URL(candidate).origin);
    } catch {
      // Origine malformée : ignorée silencieusement.
    }
  }

  return {
    defaultSrc: [self],
    scriptSrc: [self], // build de production : aucun script inline
    styleSrc: [self, "'unsafe-inline'"], // styles inline React/Tailwind
    imgSrc,
    connectSrc,
    fontSrc: [self, 'data:'],
    objectSrc: ["'none'"],
    baseUri: [self],
    formAction: [self],
    frameAncestors: ["'none'"], // l'API ne sert aucune page à encadrer
    upgradeInsecureRequests: []
  };
}

export const helmetMiddleware = helmet({
  contentSecurityPolicy:
    process.env.NODE_ENV === 'production'
      ? { useDefaults: false, directives: buildProductionCsp() }
      : false, // Disabled CSP to avoid breaking iframe preview rendering in Vite dev mode
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
});

// 3. CSRF TOKEN DEFENSE (Double-Submit Cookie + HMAC signature)
// The cookie holds a nonce.HMAC(nonce, CSRF_SECRET) token; the client must echo
// the exact same value in the X-CSRF-Token header. In development mode CSRF
// validation is skipped to allow frontend fetch calls without token management.
const CSRF_COOKIE_NAME = 'XSRF-TOKEN';

function signCsrfNonce(nonce: string): string {
  return crypto.createHmac('sha256', process.env.CSRF_SECRET || '').update(nonce).digest('hex');
}

/** Builds a fresh CSRF token: `<nonce>.<hmac_sha256(nonce, CSRF_SECRET)>`. */
export function issueCsrfToken(): string {
  const nonce = crypto.randomBytes(24).toString('hex');
  return `${nonce}.${signCsrfNonce(nonce)}`;
}

/** Verifies the HMAC signature of a CSRF token (timing-safe). */
export function isValidSignedCsrfToken(token: unknown): token is string {
  if (typeof token !== 'string') return false;
  const dotIndex = token.indexOf('.');
  if (dotIndex <= 0 || dotIndex === token.length - 1) return false;
  const nonce = token.slice(0, dotIndex);
  const signature = Buffer.from(token.slice(dotIndex + 1), 'hex');
  const expected = Buffer.from(signCsrfNonce(nonce), 'hex');
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(signature, expected);
}

function sameToken(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Always issue/refresh a signed CSRF cookie so the frontend can echo it back
  let csrfToken = req.cookies?.[CSRF_COOKIE_NAME];
  if (!isValidSignedCsrfToken(csrfToken)) {
    csrfToken = issueCsrfToken();
    res.cookie(CSRF_COOKIE_NAME, csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000
    });
  }
  // Expose the effective token (issued or existing) so downstream handlers
  // (ex. GET /api/auth/csrf-token) echo exactly the cookie value.
  res.locals.csrfToken = csrfToken;

  // Skip CSRF enforcement in development
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  // A missing secret in production would make signatures forgeable: refuse.
  if (!process.env.CSRF_SECRET) {
    console.error('[CSRF] CSRF_SECRET manquant en production — validation impossible.');
    return res.status(503).json({
      error: 'Serveur mal configuré : CSRF_SECRET absent.',
      code: 'CSRF_NOT_CONFIGURED'
    });
  }

  // In production: validate CSRF for state-changing methods
  const stateChangingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  if (stateChangingMethods.includes(req.method)) {
    // Mounted under '/api', req.path is '/auth/login' (not '/login').
    // Endpoints exemptés : actions anonymes autorisées par des secrets transmis
    // dans la requête elle-même (credentials login, token reset par email),
    // pas par le cookie de session — le pattern double-submit n'y apporte rien.
    const CSRF_EXEMPT_PATHS = ['/auth/login', '/auth/forgot-password', '/auth/reset-password'];
    const isAuthPath = CSRF_EXEMPT_PATHS.includes(req.path);
    const clientHeaderToken = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'] || req.body?._csrf;
    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
    if (
      !isAuthPath &&
      (!isValidSignedCsrfToken(clientHeaderToken) ||
        !isValidSignedCsrfToken(cookieToken) ||
        !sameToken(clientHeaderToken as string, cookieToken as string))
    ) {
      return res.status(403).json({
        error: 'Validation CSRF échouée. En-tête X-CSRF-Token manquant ou invalide.',
        code: 'CSRF_VALIDATION_FAILED'
      });
    }
  }

  next();
};

// 4. INPUT SANITIZATION MIDDLEWARE (Stripping dangerous HTML/script tags)
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  next();
};

function sanitizeObject(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  } else if (obj !== null && typeof obj === 'object') {
    const sanitized: any = {};
    for (const key of Object.keys(obj)) {
      sanitized[key] = sanitizeObject(obj[key]);
    }
    return sanitized;
  } else if (typeof obj === 'string') {
    // Strip dangerous script tags and inline event handlers.
    // Only strip `javascript:` at string start (URL context), not embedded text.
    return obj
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/^javascript:/gi, '');
  }
  return obj;
}
