/**
 * Standalone database connectivity test (Prisma 7 + Supabase PostgreSQL).
 *
 * Usage:  npm run test:db   (ou: node scripts/test-db.js depuis backend/)
 *
 * Vérifie, avec latence par étape :
 *   1. Présence des variables d'environnement requises (sans afficher les valeurs)
 *   2. Connexion à la base ($queryRaw SELECT 1)
 *   3. Lecture (User.count)
 *   4. Écriture sûre : création → relecture → suppression d'une ligne témoin
 *      dans SavedSearch (nettoyage garanti en finally)
 *
 * Code de sortie : 0 = tous les tests passent, 1 = au moins un échec.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const REQUIRED_ENV = [
  'DATABASE_URL',
  'DIRECT_URL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'JWT_SECRET',
  'CSRF_SECRET',
  'GMAIL_USER',
  'GMAIL_APP_PASSWORD',
  'FRONTEND_URL',
  'CORS_ORIGINS'
];

const OPTIONAL_ENV = ['HOST', 'PORT', 'SHADOW_DATABASE_URL'];

const PROBE_NAME = 'DB-HEALTH-CHECK';

let exitCode = 0;
const results = [];

function report(step, ok, detail = '') {
  results.push({ step, ok });
  if (!ok) exitCode = 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${step}${detail ? ` — ${detail}` : ''}`);
}

function auditEnv() {
  const missing = REQUIRED_ENV.filter(k => !process.env[k] || !String(process.env[k]).trim());
  const optionalAbsent = OPTIONAL_ENV.filter(k => !process.env[k]);
  if (missing.length === 0) {
    report('env audit', true, `${REQUIRED_ENV.length} variables requises détectées`);
  } else {
    report('env audit', false, `variables manquantes : ${missing.join(', ')}`);
  }
  if (optionalAbsent.length > 0) {
    console.log(`WARN | variables optionnelles absentes : ${optionalAbsent.join(', ')}`);
  }
}

async function timed(label, fn) {
  const start = performance.now();
  try {
    const value = await fn();
    report(label, true, `${(performance.now() - start).toFixed(1)} ms`);
    return value;
  } catch (err) {
    report(label, false, err?.message || String(err));
    throw err;
  }
}

async function main() {
  console.log('=== ARSII Backend — Test de connectivité base de données ===\n');
  auditEnv();

  if (!process.env.DATABASE_URL) {
    console.log('\nRESULT: ÉCHEC — DATABASE_URL absente, tests base impossible.');
    process.exit(1);
  }

  // Miroir exact de src/config/prisma.ts (driver adapter + SSL Supabase)
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  const prisma = new PrismaClient({ adapter });

  let probeId = null;

  try {
    // ── 1. Connexion brute ──
    await timed('db connect (SELECT 1)', async () => {
      const rows = await prisma.$queryRaw`SELECT 1 AS one`;
      if (!Array.isArray(rows) || rows.length !== 1) {
        throw new Error('Réponse SELECT 1 inattendue');
      }
    });

    // ── 2. Lecture ──
    const userCount = await timed('read (user.count)', () => prisma.user.count());
    console.log(`INFO | users en base : ${userCount}`);

    if (userCount === 0) {
      report('write (SavedSearch probe)', false, 'aucun utilisateur en base pour rattacher la ligne témoin');
    } else {
      // ── 3. Écriture sûre : create → read back → delete ──
      const owner = await timed('write setup (findFirst user)', () =>
        prisma.user.findFirst({ select: { id: true } })
      );

      probeId = await timed(`write (create ${PROBE_NAME})`, async () => {
        const created = await prisma.savedSearch.create({
          data: {
            name: PROBE_NAME,
            filters: { source: 'test-db.js', createdAt: new Date().toISOString() },
            userId: owner.id
          },
          select: { id: true }
        });
        return created.id;
      });

      await timed('write verify (findUnique)', async () => {
        const found = await prisma.savedSearch.findUnique({ where: { id: probeId } });
        if (!found || found.name !== PROBE_NAME) {
          throw new Error('Ligne témoin introuvable après création');
        }
      });
    }
  } catch {
    // Les échecs ont déjà été rapportés par timed()
  } finally {
    // ── 4. Nettoyage garanti ──
    if (probeId) {
      try {
        await prisma.savedSearch.delete({ where: { id: probeId } });
        const gone = !(await prisma.savedSearch.findUnique({ where: { id: probeId } }));
        report('cleanup (delete probe)', gone);
      } catch (err) {
        report('cleanup (delete probe)', false, err?.message || String(err));
      }
    }

    await prisma.$disconnect().catch(() => {});

    const passed = results.filter(r => r.ok).length;
    console.log('\n=================================================');
    console.log(`RESULT: ${passed}/${results.length} étapes PASS${exitCode === 0 ? ' — BASE DE DONNÉES OPÉRATIONNELLE' : ' — VOIR LES ÉCHECS CI-DESSUS'}`);
    console.log('=================================================');
    process.exit(exitCode);
  }
}

main().catch(err => {
  console.error('[FATAL] Erreur non gérée:', err?.message || err);
  process.exit(1);
});
