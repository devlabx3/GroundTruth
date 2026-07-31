# GroundTruth — Frontend MVP

Plataforma DePIN de certificación EUDR sobre Solana. Este repositorio es el frontend,
construido siguiendo los documentos de diseño del proyecto (sistema de diseño, casos de
uso, navegación, gestión de errores y modelo de datos).

## Stack

Vite + React 18 · Tailwind (tokens del sistema de diseño) · React Router (shells + guards) ·
TanStack Query (datos de servidor) · Zustand (estado efímero de sesión) · Axios (→ NestJS) ·
Supabase JS (solo Auth/Storage/Realtime) · react-i18next · @phosphor-icons/react ·
React Hook Form + Zod.

## Arrancar

```bash
npm install
cp .env.example .env   # completar credenciales
npm run dev
```

Sin credenciales de Supabase la app corre en modo maqueta (sin auth real); las rutas
públicas (`/es/`, `/es/verificar`) funcionan de inmediato.

## Despliegue (Vercel)

Vite se autodetecta; no hace falta configurar comandos. Variables de entorno mínimas:
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `VITE_API_BASE_URL` (la URL del backend
en Render, **no** `localhost`).

> Vite **incrusta** las `VITE_*` en el bundle al compilar; no se leen en tiempo de
> ejecución. Cambiar una exige **redesplegar**, y si el valor no altera el código
> resultante Vercel puede devolver un bundle con el mismo hash.

### `vercel.json` — por qué existe

El router es `createBrowserRouter`: las rutas (`/es/login`, `/es/dashboard`…) viven solo
en el cliente. Sin un rewrite, Vercel busca un fichero en esa ruta y devuelve **404 al
recargar o al entrar por enlace directo** — la navegación interna sí funciona, que es lo
que hace el fallo fácil de pasar por alto.

La regla reescribe todo a `index.html` **salvo las rutas con extensión** (`.js`, `.css`,
`.svg`…), que son ficheros reales de `dist/`: si cayeran en el rewrite, un `<img>`
recibiría el HTML y la imagen saldría rota. Se filtra por extensión y no por carpeta para
que añadir assets nuevos (hoy `assets/` y `brand/`) no obligue a tocar el fichero.

Nota: `vercel.json` **no admite claves de comentario** como `//` — su schema rechaza
propiedades desconocidas. De ahí que esta explicación viva aquí.

## Estructura

```
src/
  i18n/            Diccionarios por namespace. Español es el único completo del MVP.
                   Regla: ninguna cadena en el código; agregar idioma = agregar carpeta.
  lib/             api.js (Axios→NestJS, errores normalizados) · queryClient.js ·
                   supabase.js (solo Auth/Storage/Realtime) · privileges.js (catálogo)
  stores/          session.js (Zustand) — roles DERIVADOS, no almacenados
  components/
    ui/            Button, Card, StatusBadge, EmptyState
    shared/        SoilCoreIndicator (elemento de firma) · OnchainProgressModal (§7) ·
                   PrivilegeGate · LanguageSwitcher · ErrorInline · AlertBanner
  shells/          PublicShell · DAppLiteShell · DashboardShell · AdminShell
  router/          index.jsx (árbol de rutas) · guards.jsx (sesión→rol→privilegio)
  features/
    public/        Landing · Verificador · Contacto · Login
    dapp/          Farmer home (alertas + parcelas + nueva siembra)
    dashboard/     Dashboard home + placeholders por vista
    admin/         (placeholders por vista)
```

## Trazabilidad con los documentos

- **Paleta y tipografía** → `tailwind.config.js` (Sistema-de-Diseño §2–3). Regla del oro aplicada.
- **Núcleo de suelo** → `SoilCoreIndicator.jsx` (§4).
- **Modal on-chain** → `OnchainProgressModal.jsx` con las 7 reglas de comportamiento (§7).
- **RBAC dinámico** → `privileges.js` + `PrivilegeGate` + `session.can()` (Casos-de-Uso §0).
- **Guards sesión→rol→privilegio** → `router/guards.jsx` (Índice-de-Vistas §2.1).
- **Rutas por rol** → `router/index.jsx` (Índice-de-Vistas §3–6).
- **Errores normalizados** → `lib/api.js` (Gestión-de-Errores §6).
- **i18n** → `src/i18n/` (Sistema-de-Diseño §6).

## Pendiente (no bloquea el arranque)

- Instalar y cablear: `@supabase/supabase-js`, Leaflet, Recharts, wallet-adapter, Anchor client.
- Implementar las vistas marcadas como placeholder (topología, embarques, tesorería, etc.).
- Valores de tarifas (pricing) y diccionarios `en/de/nl/it/fr/pt`.
