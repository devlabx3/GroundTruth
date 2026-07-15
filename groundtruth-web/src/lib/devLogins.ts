/**
 * Accesos rápidos por rol — SOLO para depurar.
 *
 * Dos salvaguardas, porque "por ahora no es un problema de seguridad" tiene fecha de
 * caducidad y nadie se acuerda de quitarlo el día del despliegue:
 *
 *  1. **Las credenciales no están en el código.** Salen de `groundtruth-web/.env`
 *     (que está en `.gitignore`), así que no viajan al repositorio.
 *  2. **El bloque solo existe en desarrollo.** `import.meta.env.DEV` es `false` en un
 *     build de producción, así que Vite elimina esta rama entera como código muerto
 *     y las contraseñas **no llegan al bundle**, aunque las variables estuvieran
 *     definidas al compilar.
 *
 * Para que no aparezcan: basta con no definir las variables. Si faltan, la lista sale
 * vacía y el login se comporta como siempre.
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
 * frágil ante cualquier recarga en caliente). Vite sigue sustituyendo cada
 * `import.meta.env.X` por su literal al compilar, así que la seguridad no cambia: con
 * `DEV = false` la función entera se convierte en `return []` y las cadenas desaparecen.
 */
export function accesosRapidos(): AccesoRapido[] {
  if (!import.meta.env.DEV) return [];

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
