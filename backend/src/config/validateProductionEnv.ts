const REQUIRED_PRODUCTION_ENV_VARS = ['FRONTEND_URL', 'CORS_ORIGINS'] as const;

export type ProductionEnvVar = (typeof REQUIRED_PRODUCTION_ENV_VARS)[number];

export function getMissingProductionEnvVars(): ProductionEnvVar[] {
  if (process.env.NODE_ENV !== 'production') {
    return [];
  }
  return REQUIRED_PRODUCTION_ENV_VARS.filter(
    (name) => !process.env[name] || process.env[name]!.trim() === ''
  );
}

export function assertProductionEnv(): void {
  const missing = getMissingProductionEnvVars();
  if (missing.length > 0) {
    throw new Error(
      `Configuration production incomplète : variable(s) manquante(s) : ${missing.join(', ')}. ` +
        'Définissez-les dans le tableau de bord Render (ou dans .env) avant de démarrer en NODE_ENV=production.'
    );
  }
}