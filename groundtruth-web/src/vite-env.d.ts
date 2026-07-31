/// <reference types="vite/client" />

/**
 * Las variables de entorno del cliente, declaradas. Sin esto, `import.meta.env.VITE_LO_QUE_SEA`
 * es `any` y un typo en el nombre pasa desapercibido hasta que la app corre en producción
 * apuntando a `undefined`.
 *
 * Ninguna es obligatoria a propósito: sin Supabase la app arranca en modo maqueta.
 */
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SOLANA_CLUSTER?: string;

  /**
   * Accesos rápidos por rol en el login (ver `lib/devLogins.ts`).
   *
   * En `dev` salen solos. Para un build de producción hace falta además
   * `VITE_DEV_LOGINS=true` — y entonces las credenciales viajan EN CLARO en el bundle,
   * legibles por cualquiera que abra el código fuente de la página.
   */
  readonly VITE_DEV_LOGINS?: string;
  readonly VITE_DEV_OPERADOR_EMAIL?: string;
  readonly VITE_DEV_OPERADOR_PASSWORD?: string;
  readonly VITE_DEV_LOGISTICA_EMAIL?: string;
  readonly VITE_DEV_LOGISTICA_PASSWORD?: string;
  readonly VITE_DEV_AGRICULTOR_EMAIL?: string;
  readonly VITE_DEV_AGRICULTOR_PASSWORD?: string;
  readonly VITE_DEV_ADMIN_EMAIL?: string;
  readonly VITE_DEV_ADMIN_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
