import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import crypto from 'crypto';

// 1. RATE LIMITERS
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth attempts per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: {
    error: 'Trop de tentatives de connexion. Veuillez réessayer dans 15 minutes.',
    code: 'TOO_MANY_REQUESTS'
  }
});

export const globalApiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per 15 minutes
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
export const helmetMiddleware = helmet({
  contentSecurityPolicy: false, // Disabled CSP to avoid breaking iframe preview rendering in Vite dev mode
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
});

// 3. CSRF TOKEN DEFENSE (Double-Submit Cookie Pattern)
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Ensure a CSRF token cookie exists
  let csrfToken = req.cookies?.['XSRF-TOKEN'];
  
  if (!csrfToken) {
    csrfToken = crypto.randomBytes(24).toString('hex');
    res.cookie('XSRF-TOKEN', csrfToken, {
      httpOnly: false, // Readable by frontend JS to echo in X-CSRF-Token header
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
  }

  // Validate CSRF token for state-changing HTTP methods
  const stateChangingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  if (stateChangingMethods.includes(req.method)) {
    // Exempt initial login or public auth endpoints if needed, but validate if present
    const isLogin = req.path === '/login' || req.path === '/api/auth/login';
    const clientHeaderToken = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'] || req.body?._csrf;

    if (!isLogin && (!clientHeaderToken || clientHeaderToken !== csrfToken)) {
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
    // Strip dangerous script tags and inline event handlers
    return obj
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/javascript:/gi, '');
  }
  return obj;
}
