# Documentación de GroundTruth

Fuente de verdad del proyecto, generada durante la fase de diseño (Claude web). Toda funcionalidad nueva debe ser consistente con estos documentos; si el código y un documento entran en conflicto, se resuelve el conflicto explícitamente (no se ignora el documento).

## arquitectura/ — qué es el sistema y por qué

Leer en este orden:

1. [contexto-ground2.md](arquitectura/contexto-ground2.md) — **documento maestro.** Arquitectura técnica del MVP (v2), decisiones D1–D10, stack, flujo Pay-per-Proof. Milestone 3 — WayLearn.
2. [Anexo-1-Diagrama-de-Arquitectura.md](arquitectura/Anexo-1-Diagrama-de-Arquitectura.md) — diagrama general (Mermaid).
3. [Anexo-2-Flujo-Basico-del-Usuario.md](arquitectura/Anexo-2-Flujo-Basico-del-Usuario.md) — flujo usuario → wallet → app → Solana → BD.
4. [Anexo-3-Delimitacion-OnChain-OffChain.md](arquitectura/Anexo-3-Delimitacion-OnChain-OffChain.md) — qué vive en Solana, qué en Arweave, qué en Supabase.
- `GroundTruth-Arquitectura-MVP-Milestone3.docx` — versión entregable del documento maestro (mismo contenido, formato Word).

## producto/ — qué se construye

Derivan del documento maestro y se derivan entre sí en este orden:

1. [GroundTruth-Casos-de-Uso-por-Rol.md](producto/GroundTruth-Casos-de-Uso-por-Rol.md) — RBAC (Visitante, Agricultor, Operador, Admin) e inventario de casos de uso con ramas de error.
2. [GroundTruth-Indice-de-Vistas-y-Navegacion.md](producto/GroundTruth-Indice-de-Vistas-y-Navegacion.md) — mapa de rutas, shells, guards y componentes por vista. **Es el espejo del router en `src/router/`** — una fila por caso de uso.
3. [GroundTruth-Modelo-de-Datos.md](producto/GroundTruth-Modelo-de-Datos.md) — tablas Supabase (PostgreSQL + PostGIS); cada tabla justificada por un caso de uso o una decisión D1–D10.
4. [GroundTruth-Gestion-de-Errores.md](producto/GroundTruth-Gestion-de-Errores.md) — catálogo de errores: clasificación, presentación en UI y recuperación. Base del namespace i18n `errors.json`.

## diseno/ — cómo se ve y se comunica

1. [GroundTruth-Sistema-de-Diseno.md](diseno/GroundTruth-Sistema-de-Diseno.md) — identidad visual ("autoridad de certificación privada"), paleta, tipografía, stack de frontend, i18n. Toda pantalla nueva debe cumplirlo.
2. [GroundTruth-Elementos-Graficos-y-Fotografia.md](diseno/GroundTruth-Elementos-Graficos-y-Fotografia.md) — especificación de ilustración y fotografía por pieza. Los archivos fuente (iconos y láminas, ~55 MB) viven fuera del repo en `../design-assets/` (junto a este repo); las versiones optimizadas para web entrarán a `public/brand/` cuando el código las use.

## Estado del scaffold (julio 2026)

- El código en `src/` fue verificado sintácticamente pero **nunca se corrió un build real** (el entorno de origen no tenía acceso al registro de npm). Primer paso pendiente: instalar dependencias con **pnpm** (decisión: se usa pnpm, no npm) y levantar `dev` para cazar errores de import que solo detecta el bundler.
- `src/features/admin/pages/` no existe aún: las vistas de Admin son placeholders inline dentro de `src/router/index.jsx`. Extraerlas a archivos propios es tarea pendiente.
