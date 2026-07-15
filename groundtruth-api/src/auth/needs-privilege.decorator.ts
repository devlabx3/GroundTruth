import { SetMetadata } from '@nestjs/common';

export const NEEDS_PRIVILEGE = 'needs_privilege';

/**
 * Exige que el usuario tenga (al menos uno de) estos privilegios en la unidad
 * activa (header `x-operador-id`). Espejo del catálogo de la plataforma.
 */
export const NeedsPrivilege = (...anyOf: string[]) => SetMetadata(NEEDS_PRIVILEGE, anyOf);
