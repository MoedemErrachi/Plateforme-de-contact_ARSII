import { defineConfig } from '@prisma/config';
import 'dotenv/config';

export default defineConfig({
  datasource: {
    // Le CLI (migrations, introspection, db push) utilise la connexion directe
    // à la base ; le runtime utilise DATABASE_URL via son driver adapter.
    // (@prisma/config v7 n'expose pas de champ directUrl : on réserve donc cette
    // entrée à la connexion directe.)
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
  migrations: {
    seed: './prisma/seed.ts',
  },
});
