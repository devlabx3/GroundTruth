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
