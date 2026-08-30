import type { Express } from 'express';
import path from 'path';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { openapiDefinition } from './openapi';

/**
 * Montage de la documentation Swagger UI — LOCAL UNIQUEMENT.
 *
 * Cette fonction ne doit être appelée que lorsque l'environnement n'est PAS
 * la production (`process.env.NODE_ENV !== 'production'`, voir `src/app.ts`).
 * Sur Render (NODE_ENV=production) la route `/api-docs` n'est donc jamais
 * enregistrée et répond 404.
 *
 * Le spec est généré à partir des annotations `@openapi` des fichiers de
 * routes (`src/routes/*.ts`) fusionnées avec `openapiDefinition`.
 */
export function setupSwagger(app: Express): void {
  // glob attend des séparateurs '/' : path.join() sur Windows renvoie des '\'
  // qui sont traités comme des caractères d'échappement (aucun fichier trouvé).
  const routesGlob = path.join(process.cwd(), 'src', 'routes', '*.ts').replace(/\\/g, '/');

  const spec = swaggerJSDoc({
    definition: openapiDefinition,
    apis: [routesGlob]
  });

  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customSiteTitle: 'ARSII CRM — API',
      swaggerOptions: {
        persistAuthorization: true,
        filter: true,
        displayRequestDuration: true
      }
    })
  );

  // Spec brut (JSON) pour outils externes / Postman import.
  app.get('/api-docs.json', (_req, res) => {
    res.status(200).json(spec);
  });
}