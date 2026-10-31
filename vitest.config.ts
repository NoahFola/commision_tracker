import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL ?? '';
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? '';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'app/**/*.test.ts', 'app/**/*.test.tsx'],
    setupFiles: ['./vitest.setup.ts', './vitest.setup.dom.ts'],
    globalSetup: ['./vitest.global-setup.ts'],
    env: {
      // Forward Upstash credentials to workers so the rate-limit tests
      // can run. Absent credentials => those tests skip.
      UPSTASH_REDIS_REST_URL,
      UPSTASH_REDIS_REST_TOKEN,
    },
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
