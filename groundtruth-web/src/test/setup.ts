import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Cada test empieza con el DOM limpio: un componente que sobrevive al siguiente
// test produce fallos fantasma que se persiguen durante horas.
afterEach(cleanup);
