import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          // Vendor React isolé dans un chunk stable : cache navigateur longue
          // durée, les chunks de pages (React.lazy) peuvent évoluer sans
          // invalider ce cache.
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          },
        },
      },
    },
    server: {
      port: parseInt(process.env.PORT || '3000', 10),
      proxy: {
        '/api': {
          target: process.env.VITE_BACKEND_URL || 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
        },
        // Service chatbot/OCR (FastAPI) : même origine que le frontend via ce
        // proxy → plus d'erreurs CORS / « Failed to fetch » en développement.
        '/chatbot-api': {
          target: process.env.VITE_CHATBOT_API_URL || 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/chatbot-api/, ''),
        },
      },
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
