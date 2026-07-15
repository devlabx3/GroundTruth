import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    // Los `.spec.ts` son unitarios: lógica pura, sin BD ni cadena. Corren en CI.
    // Los de integración (BD + Solana reales) viven en `test/` y se lanzan aparte:
    // necesitan infraestructura y no pueden bloquear un pull request.
    include: ['src/**/*.spec.ts'],
    environment: 'node',
  },
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
});
