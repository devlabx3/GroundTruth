/** Tipos compartidos de la capa de presentación. */
import type { ReactNode } from 'react';

export type StepStatus = 'pending' | 'active' | 'done' | 'failed';

/**
 * Un paso del OnchainProgressModal. `labelKey` y `errorKey` son CLAVES i18n, nunca
 * texto: la regla del Sistema-de-Diseño §8 es que en el código no viaja ni una frase.
 */
export interface SagaStepDef {
  key: string;
  labelKey: string;
  detail?: string;
  action?: ReactNode;
}

export interface SagaStep extends SagaStepDef {
  status: StepStatus;
  errorKey?: string;
}

/** Estado del sello de 4 etapas (SoilCoreIndicator). */
export type SealSize = 'sm' | 'md' | 'lg';
