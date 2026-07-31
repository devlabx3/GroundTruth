/**
 * Accesos rápidos por rol — depuración y demos.
 *
 * ⚠ **Las credenciales viajan EN CLARO dentro del bundle.** Vite sustituye cada
 * `import.meta.env.X` por su literal al compilar: no son un secreto de servidor, son
 * texto plano que cualquiera lee abriendo el código fuente de la página. Quien tenga la
 * URL tiene las contraseñas.
 *
 * Salvaguardas que quedan:
 *
 *  1. **Las credenciales no están en el repositorio.** Salen del `.env` (ignorado por
 *     git), así que no se filtran por ahí.
 *  2. **En producción hay que pedirlo explícitamente.** En `dev` los botones salen solos;
 *     para un build de producción hace falta `VITE_DEV_LOGINS=true`, que es una decisión
 *     deliberada de quien despliega, no un descuido.
 *  3. **Un rol sin email o sin contraseña no se ofrece**: no definir sus variables lo
 *     quita de la lista.
 *
 * Antes de activarlo en un entorno público, pregúntate qué puede hacer la cuenta más
 * privilegiada de la lista. Si hay datos reales detrás, usa cuentas de demo desechables
 * y deja fuera la de admin.
 */
export interface AccesoRapido {
  /** Clave i18n del rol (`public:login.dev_roles.*`). */
  rol: string;
  etiqueta: string;
  email: string;
  password: string;
}

/**
 * La lista se construye DENTRO de la función, no en el ámbito del módulo: un `const` de
 * módulo se evalúa una sola vez al importar, y eso lo volvía imposible de probar (y
 * frágil ante cualquier recarga en caliente).
 */
export function accesosRapidos(): AccesoRapido[] {
  // En desarrollo salen solos. En un build de producción hay que pedirlo con
  // `VITE_DEV_LOGINS=true`: sin esa marca la función es `return []` y Vite elimina las
  // credenciales del bundle como código muerto.
  const habilitado = import.meta.env.DEV || import.meta.env.VITE_DEV_LOGINS === 'true';
  if (!habilitado) return [];

  const cuentas: { rol: string; etiqueta: string; email?: string; password?: string }[] = [
    {
      rol: 'operator',
      etiqueta: 'Dirección · 10 privilegios',
      email: import.meta.env.VITE_DEV_OPERADOR_EMAIL,
      password: import.meta.env.VITE_DEV_OPERADOR_PASSWORD,
    },
    {
      rol: 'logistics',
      etiqueta: 'Logística · sin certificados.emitir',
      email: import.meta.env.VITE_DEV_LOGISTICA_EMAIL,
      password: import.meta.env.VITE_DEV_LOGISTICA_PASSWORD,
    },
    {
      rol: 'farmer',
      etiqueta: 'Agricultor · sin membresía',
      email: import.meta.env.VITE_DEV_AGRICULTOR_EMAIL,
      password: import.meta.env.VITE_DEV_AGRICULTOR_PASSWORD,
    },
    {
      rol: 'admin',
      etiqueta: 'Admin de plataforma · cruza unidades',
      email: import.meta.env.VITE_DEV_ADMIN_EMAIL,
      password: import.meta.env.VITE_DEV_ADMIN_PASSWORD,
    },
  ];

  // Un rol sin correo O sin contraseña no se ofrece: un botón que no entra es peor que
  // no tener botón.
  return cuentas.filter((c): c is AccesoRapido => Boolean(c.email) && Boolean(c.password));
}
