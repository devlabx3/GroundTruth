# Documentación de GroundTruth

Fuente de verdad del proyecto. Toda funcionalidad nueva debe ser consistente con estos documentos; si el código y un documento entran en conflicto, se resuelve el conflicto explícitamente (no se ignora el documento).

## arquitectura/ — qué es el sistema y por qué

[**GroundTruth-Arquitectura-Tecnica-MVP.md**](arquitectura/GroundTruth-Arquitectura-Tecnica-MVP.md) — **documento maestro y único**. Arquitectura técnica del MVP, decisiones D1–D10, stack, flujo Pay-per-Proof y **7 diagramas** (dominio, actores, autorización, saga de certificación, almacenamiento, flujos de frontend).

Lleva una **leyenda de estado** contrastada contra el código: ✅ construido y verificado · ⚠️ construido con matiz · 🔜 diseño objetivo, no construido. Si algo dice ⚠️, el matiz está explicado en el sitio.

> **Los tres anexos se eliminaron** (julio 2026). Eran versiones simplificadas de los diagramas §3, §11 y §12.1 de este mismo documento: mantener tres copias de la misma verdad solo garantiza que acaben divergiendo. Si hace falta un diagrama suelto para una presentación, se extrae del maestro.

## producto/ — qué se construye

Derivan del documento maestro y se derivan entre sí en este orden:

1. [GroundTruth-Casos-de-Uso-por-Rol.md](producto/GroundTruth-Casos-de-Uso-por-Rol.md) — RBAC (Visitante, Agricultor, Operador, Admin) e inventario de casos de uso con ramas de error.
2. [GroundTruth-Indice-de-Vistas-y-Navegacion.md](producto/GroundTruth-Indice-de-Vistas-y-Navegacion.md) — mapa de rutas, shells, guards y componentes por vista. **Es el espejo del router en `src/router/`** — una fila por caso de uso.
3. [GroundTruth-Modelo-de-Datos.md](producto/GroundTruth-Modelo-de-Datos.md) — tablas Supabase (PostgreSQL + PostGIS); cada tabla justificada por un caso de uso o una decisión D1–D10.
4. [GroundTruth-Gestion-de-Errores.md](producto/GroundTruth-Gestion-de-Errores.md) — catálogo de errores: clasificación, presentación en UI y recuperación. Base del namespace i18n `errors.json`.

## diseno/ — cómo se ve y se comunica

1. [GroundTruth-Sistema-de-Diseno.md](diseno/GroundTruth-Sistema-de-Diseno.md) — identidad visual ("autoridad de certificación privada"), paleta, tipografía, stack de frontend, i18n. Toda pantalla nueva debe cumplirlo.
> La **especificación de ilustración y fotografía** (inventario de piezas, dirección fotográfica, notas de producción) **no se versiona**: acompaña al arte fuente, que vive fuera del repo en `../design-assets/` (~55 MB). Las versiones optimizadas para web entran a `groundtruth-web/public/brand/` cuando el código las usa.

## Estado de la construcción (julio 2026)

Las **30 vistas del Índice de Vistas están construidas** (Visitante 5, Agricultor 5, Operador 13, Admin 12), con router 1:1, guards sesión→rol→privilegio, selector de contexto (§2.2) y diccionario `es` completo (7 namespaces). Gestor de paquetes: **pnpm** (decisión, no npm).

**Modo maqueta:** no hay backend aún. Los datos vienen de `features/*/fixtures.js` vía TanStack Query (`demoQueryFn` en `src/lib/demo.js`) y el login usa perfiles demo (`src/lib/demo.js`); las sagas on-chain se simulan con `src/lib/useSimulatedSaga.js`. Al existir el backend NestJS, cada vista cambia su `queryFn` al `api` real sin tocar el JSX (los puntos exactos están marcados con `TODO backend:`).

Integrados: **Leaflet** (`ParcelMap`: pines de estado, polígono y modo dibujo con área geodésica que alimenta el gate de sensores) y **Recharts** (`TelemetryChart`: small multiples de una serie esmeralda — la paleta cerrada no admite pareja categórica). **Code-splitting por vista** (`React.lazy` en el router): Leaflet y Recharts solo se descargan en las vistas que los usan. Los 7 idiomas del roadmap tienen diccionario completo (376+ claves, paridad verificada por script).

Pendientes conocidos:
- **react-leaflet debe quedarse en ^4.x** — la v5 exige React 19; el stack cerrado es React 18.
- **Libs diferidas restantes**: `@supabase/supabase-js` (auth real) y las de Solana (wallet adapter, web3.js, Anchor).
- **Diccionarios eager**: los 7 idiomas viajan en el bundle inicial (~50 kB gzip); si pesa, migrar a carga por idioma (`i18next-resources-to-backend`).
- **eslint** está en el script `lint` pero no en devDependencies.
