import { defineConfig } from 'vitest/config';

// Set before workers start so calendar arithmetic exercises both DST transitions.
process.env.TZ = 'America/New_York';

export default defineConfig({
  test: {
    environment: 'node',
    pool: 'forks',
    include: ['src/**/*.test.ts'],
  },
});
