import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'is_public';
/** Marca un endpoint como accesible sin sesión (health, webhook Helius, verificador). */
export const Public = () => SetMetadata(IS_PUBLIC, true);
