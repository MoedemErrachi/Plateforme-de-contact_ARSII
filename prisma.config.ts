import { defineConfig } from '@prisma/config';
import 'dotenv/config';

const databaseUrl = process.env.DATABASE_URL;
const shadowDatabaseUrl = process.env.SHADOW_DATABASE_URL;

console.log('Using database URL:', databaseUrl);

export default defineConfig({
  datasource: {
    url: databaseUrl,
    shadowDatabaseUrl,
  },
});