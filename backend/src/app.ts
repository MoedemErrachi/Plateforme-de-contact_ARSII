import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import apiRouter from './routes';
import { errorHandler } from './middleware/errorHandler';
import { authenticateJWT } from './middleware/authenticateJWT';
import { setupSwagger } from './docs/setupSwagger';
import {
  helmetMiddleware,
  globalApiRateLimiter,
  authRateLimiter,
  csrfProtection,
  sanitizeInput
} from './middleware/security';

export function createApp() {
  const app = express();

  // Enable trust proxy for Cloud Run and Nginx reverse proxies
  app.set('trust proxy', 1);

  // 1. Helmet Security Headers
  app.use(helmetMiddleware);

  // 2. CORS Configuration — all allowed origins must come from CORS_ORIGINS env var
  const allowedOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token', 'X-XSRF-Token']
  }));

  // 3. Body Parsers with 10MB payload size limits
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // 4. Rate Limiters & Security Defense Layers
  app.use('/api', globalApiRateLimiter);
  app.use('/api/auth/login', authRateLimiter);

  // 5. CSRF Token Protection & Input Sanitization
  // csrfProtection : double-submit cookie signé HMAC(CSRF_SECRET). En production,
  // les méthodes mutantes exigent l'en-tête X-CSRF-Token égal au cookie XSRF-TOKEN
  // (endpoints anonymes exemptés : login, forgot-password, reset-password).
  app.use('/api', csrfProtection);
  app.use('/api', sanitizeInput);

  // 6. Global JWT authentication — tous les endpoints /api sont privés.
  // Seuls le login, la demande/reset de mot de passe, le token CSRF, le logout
  // et la sonde de santé restent publics.
  const PUBLIC_AUTH_PATHS = ['/auth/login', '/auth/csrf-token', '/auth/logout', '/auth/forgot-password', '/auth/reset-password', '/health'];
  app.use('/api', (req, res, next) => {
    if (PUBLIC_AUTH_PATHS.includes(req.path)) {
      return next();
    }
    authenticateJWT(req, res, next);
  });

  // 6bis. Documentation Swagger — LOCAL UNIQUEMENT.
  // NODE_ENV=production sur Render : la route /api-docs n'est jamais montée.
  if (process.env.NODE_ENV !== 'production') {
    setupSwagger(app);
  }

  // 7. API Route Handlers
  app.use('/api', apiRouter);

  // 8. Global Error Handler
  app.use('/api', errorHandler);

  return app;
}
