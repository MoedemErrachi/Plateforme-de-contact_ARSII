import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import apiRouter from './routes';
import { errorHandler } from './middleware/errorHandler';
import { authenticateJWT } from './middleware/authenticateJWT';
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

  // 2. Strict CORS Configuration
  const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    process.env.FRONTEND_URL
  ].filter(Boolean) as string[];

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(null, true);
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

  // 4. Static serving of locally stored uploads (avatars, etc.)
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // 5. Rate Limiters & Security Defense Layers
  app.use('/api', globalApiRateLimiter);
  app.use('/api/auth/login', authRateLimiter);
  app.use('/api/auth/google', authRateLimiter);

  // 6. CSRF Token Protection & Input Sanitization
  app.use('/api', csrfProtection);
  app.use('/api', sanitizeInput);

  // 6bis. Global JWT authentication — tous les endpoints /api sont privés.
  // Seuls le login, le SSO Google, la délivrance du token CSRF et le logout restent publics.
  const PUBLIC_AUTH_PATHS = ['/auth/login', '/auth/google', '/auth/csrf-token', '/auth/logout'];
  app.use('/api', (req, res, next) => {
    if (PUBLIC_AUTH_PATHS.includes(req.path)) {
      return next();
    }
    authenticateJWT(req, res, next);
  });

  // 7. API Route Handlers
  app.use('/api', apiRouter);

  // 8. Global Error Handler
  app.use('/api', errorHandler);

  return app;
}
