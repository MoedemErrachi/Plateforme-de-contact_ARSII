import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      include: [
        'src/utils/**',
        'src/validators/contactValidator.ts',
        'src/middleware/authorizeRole.ts',
      ],
      exclude: [
        'src/**/*.test.ts',
        'src/docs/**',
        'src/config/**',
        'src/routes/**',
        'src/controllers/**',
        'node_modules/**',
      ],
    },
  },
});
