import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const vercelConfigPath = join(__dirname, '..', '..', 'vercel.json');
const rawConfig = readFileSync(vercelConfigPath, 'utf-8');
const vercelConfig = JSON.parse(rawConfig) as {
  routes?: Array<{ src?: string; dest?: string; env?: string[] }>;
};

const FORBIDDEN_PATTERNS = [/onrender\.com/i, /vercel\.app/i, /arsii-(frontend|backend|chatbot)[.-]/i];

describe('vercel.json', () => {
  it('ne contient aucune URL de déploiement en dur', () => {
    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(rawConfig, `motif interdit trouvé : ${pattern}`).not.toMatch(pattern);
    }
  });

  it('proxie /api et /chatbot-api via des variables d’environnement Vercel', () => {
    expect(vercelConfig.routes).toBeDefined();
    const routes = vercelConfig.routes!;

    const apiRoute = routes.find((r) => r.src === '/api/(.*)');
    expect(apiRoute?.dest).toBe('${BACKEND_URL}/api/$1');
    expect(apiRoute?.env).toContain('BACKEND_URL');

    const chatbotRoute = routes.find((r) => r.src === '/chatbot-api/(.*)');
    expect(chatbotRoute?.dest).toBe('${CHATBOT_URL}/$1');
    expect(chatbotRoute?.env).toContain('CHATBOT_URL');
  });

  it('conserve le fallback SPA sur /index.html', () => {
    expect(vercelConfig.routes).toBeDefined();
    const fallback = vercelConfig.routes!.find((r) => r.src === '/((?!assets/).*)');
    expect(fallback?.dest).toBe('/index.html');
  });
});