/**
 * Audit + correction des libellés « pays d'origine » (countryOfOrigin) en base.
 *
 * Usage (depuis backend/) :
 *   npx tsx scripts/fixCountryNames.ts --dry     # rapport seul, aucune écriture
 *   npx tsx scripts/fixCountryNames.ts           # applique les réécritures
 *
 * Chaque valeur distincte est repliée via normalizeCountry()/iso2ForCountry()
 * (glossaire unifié + aliases + argot « non renseigné ») :
 *   - valeurs « non renseigné » (N/A, inconnu, -, …)      → NULL
 *   - valeurs résolues vers un libellé canonique différent → réécrites
 *   - valeurs canonicales                               → conservées
 *   - valeurs non reconnaissables                        → laissées (signalées)
 *
 * Une sauvegarde JSON des réécritures est déposée hors du repo avant écriture.
 */

import { writeFile } from 'node:fs/promises';
import os from 'node:os';
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { normalizeCountry, iso2ForCountry, COUNTRY_FRENCH } from '../src/services/contactService';

// Client dédié : `servername: 'all'` est requis par Supavisor (pooler Supabase)
// pour router le TLS/SNI correctement depuis certaines connexions.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false, servername: 'all' }
});
const prisma = new PrismaClient({ adapter });

const dryRun = process.argv.includes('--dry');

interface CountryRow {
  country: string | null;
  n: number;
}

interface PlanRow {
  value: string;
  n: number;
  kind: 'NULL' | 'UPDATE' | 'KEEP' | 'UNKNOWN';
  target: string | null;
  iso2: string | null;
}

async function distinctCountries(): Promise<CountryRow[]> {
  return prisma.$queryRaw<CountryRow[]>`
    SELECT "countryOfOrigin" AS country, COUNT(*)::int AS n
    FROM "Contact"
    WHERE "countryOfOrigin" IS NOT NULL AND "countryOfOrigin" <> ''
    GROUP BY "countryOfOrigin"
    ORDER BY "countryOfOrigin"
  `;
}

function classify(rows: CountryRow[]): PlanRow[] {
  return rows.map(row => {
    const value = row.country!;
    const canon = normalizeCountry(value);
    const iso2 = iso2ForCountry(value);
    if (canon === '') return { value, n: row.n, kind: 'NULL' as const, target: null, iso2 };
    if (canon !== value) return { value, n: row.n, kind: 'UPDATE' as const, target: canon, iso2 };
    if (iso2 === null) return { value, n: row.n, kind: 'UNKNOWN' as const, target: value, iso2: null };
    return { value, n: row.n, kind: 'KEEP' as const, target: value, iso2 };
  });
}

async function applyPlans(plans: PlanRow[]): Promise<number> {
  let updated = 0;
  for (const plan of plans) {
    if (plan.kind !== 'NULL' && plan.kind !== 'UPDATE') continue;
    const result = await prisma.contact.updateMany({
      where: { countryOfOrigin: plan.value },
      data: plan.kind === 'NULL' ? { countryOfOrigin: null } : { countryOfOrigin: plan.target }
    });
    updated += result.count;
  }
  return updated;
}

async function main() {
  console.log(`Glossaire pays : ${COUNTRY_FRENCH.length} entrées ISO → FR`);
  const rows = await distinctCountries();
  console.log(`Valeurs distinctes de countryOfOrigin (non vides) : ${rows.length}`);

  if (rows.length === 0) {
    console.log('Aucun pays à corriger.');
    await prisma.$disconnect();
    return;
  }

  const plans = classify(rows);

  const byKind = plans.reduce<Record<string, number>>((acc, p) => {
    acc[p.kind] = (acc[p.kind] ?? 0) + p.n;
    return acc;
  }, {});
  console.log('\nRépartition (contacts concernés) :');
  console.table(byKind);

  const toChange = plans.filter(p => p.kind === 'NULL' || p.kind === 'UPDATE');
  if (toChange.length > 0) {
    console.log('\nRéécritures prévues :');
    console.table(toChange.map(p => ({ valeur: p.value, contacts: p.n, devient: p.target ?? 'NULL' })));
  }

  const unknowns = plans.filter(p => p.kind === 'UNKNOWN');
  if (unknowns.length > 0) {
    console.log('\nPays non reconnaissables (laissés tels quels, à trier à la main) :');
    console.table(unknowns.map(u => ({ valeur: u.value, contacts: u.n })));
  }

  if (dryRun) {
    console.log('\n[DRY RUN] Aucune écriture effectuée.');
    await prisma.$disconnect();
    return;
  }

  console.log('\nSauvegarde des réécritures (hors repo)…');
  const backupPath = `${os.tmpdir()}/arsii-fixCountryNames-${Date.now()}.json`;
  await writeFile(backupPath, JSON.stringify({ appliedAt: new Date().toISOString(), plans }, null, 2), 'utf8');
  console.log(`Backup → ${backupPath}`);

  const updated = await applyPlans(plans);
  console.log(`\nContacts mis à jour : ${updated}`);

  const after = await distinctCountries();
  console.log(`\nValeurs distinctes restantes : ${after.length}`);
  console.table(after.map(r => ({ pays: r.country, contacts: r.n })));

  const unresolvable = after.filter(r => r.country && iso2ForCountry(r.country) === null);
  if (unresolvable.length > 0) {
    console.log('\nPays encore non mappables (resteront « pays non reconnus ») :');
    console.table(unresolvable);
  } else {
    console.log('\nToutes les valeurs restantes sont mappables (iso2 résolu).');
  }

  await prisma.$disconnect();
}

main().catch(async err => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});