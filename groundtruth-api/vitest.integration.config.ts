import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

/**
 * Tests de integración: contra el sistema vivo (API + Postgres + Solana).
 * Config aparte a propósito — NO deben correr en CI ni en `pnpm test`.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.integration.ts'],
    environment: 'node',
    testTimeout: 60_000, // hay transacciones on-chain de por medio
    hookTimeout: 30_000,
  },
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
});
