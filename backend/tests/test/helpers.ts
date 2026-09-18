import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

export interface TestUserPayload {
  id: string;
  email: string;
  name: string;
  role: string;
  privilege?: string;
  tokenVersion?: number;
}

export function signToken(user: TestUserPayload): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      privilege: user.privilege,
      tokenVersion: user.tokenVersion ?? 0
    },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
}

export function buildTestApp(register: (app: express.Express) => void = () => {}) {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  register(app);
  app.use((err: any, _req: any, res: any, _next: any) => {
    const status = err?.statusCode || 500;
    res.status(status).json({ error: err?.message || 'Erreur interne du serveur.' });
  });
  return app;
}