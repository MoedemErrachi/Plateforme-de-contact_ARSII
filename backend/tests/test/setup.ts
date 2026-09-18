process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.GMAIL_USER = process.env.GMAIL_USER || 'test@example.com';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';