import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      include: [
        'src/**',
      ],
      exclude: [
        'src/**/*.test.ts',
        'src/test/**',
        'src/docs/**',
        'src/config/**',
        'src/server.ts',
        'src/app.ts',
        'node_modules/**',
      ],
    },
  },
});
