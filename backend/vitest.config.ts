import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      include: [
        'src/**',
      ],
      exclude: [
        'tests/**',
        'src/docs/**',
        'src/config/**',
        'src/server.ts',
        'src/app.ts',
        'node_modules/**',
      ],
    },
  },
});
