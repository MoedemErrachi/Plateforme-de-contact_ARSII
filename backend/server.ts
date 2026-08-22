import { createApp } from './src/app';
import { prisma } from './src/config/prisma';

// Arrêt propre (SIGTERM : Cloud Run / Docker ; SIGINT : Ctrl+C local) :
// on cesse d'accepter les nouvelles connexions, on laisse les requêtes en
// cours se terminer, puis on ferme les connexions base de données.
const SHUTDOWN_TIMEOUT_MS = 10_000;

async function startServer() {
  const app = createApp();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;
  const HOST = process.env.HOST || '0.0.0.0';

  const server = app.listen(PORT, HOST, () => {
    console.log(`Backend server running on http://${HOST}:${PORT}`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[FATAL] Port ${PORT} is already in use. Another process is occupying this port.`);
      process.exit(1);
    }
    console.error('[FATAL] Server error:', err);
    process.exit(1);
  });

  let isShuttingDown = false;
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`[${signal}] Arrêt gracieux du serveur...`);

    // Force l'arrêt si les requêtes en cours ne se terminent pas à temps.
    const forceExit = setTimeout(() => {
      console.error(`[SHUTDOWN] Timeout après ${SHUTDOWN_TIMEOUT_MS} ms — arrêt forcé.`);
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    try {
      await new Promise<void>(resolve => server.close(() => resolve()));
      await prisma.$disconnect();
      console.log('[SHUTDOWN] Serveur arrêté proprement.');
      process.exit(0);
    } catch (err) {
      console.error('[SHUTDOWN] Erreur pendant l\'arrêt :', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('Failed to start backend server:', err);
  process.exit(1);
});
