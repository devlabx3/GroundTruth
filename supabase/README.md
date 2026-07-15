# Supabase — esquema de GroundTruth

Migraciones derivadas 1:1 de [`docs/producto/GroundTruth-Modelo-de-Datos.md`](../docs/producto/GroundTruth-Modelo-de-Datos.md). Si el esquema y ese documento divergen, se resuelve explícitamente — el documento es la fuente de verdad de diseño.

Esta carpeta vivirá dentro de `groundtruth-api/` (NestJS) cuando ese repo exista; mientras tanto es hermana para poder aplicarse ya.

## Orden de migraciones

| Archivo | Contenido |
| --- | --- |
| `0001_extensiones_y_tipos.sql` | pgcrypto, PostGIS, 9 ENUMs (§5), esquema `private`, trigger `updated_at` |
| `0002_identidad_rbac.sql` | operadores, usuarios, sub_roles, catálogo de privilegios (+seed), membresías, guardarraíl "nunca sin timón" |
| `0003_agro_y_certificacion.sql` | cultivos (+seed HS codes), fincas, parcelas (área PostGIS generada, GIST), nodos, **lecturas_telemetria particionada por mes** (BRIN + BTREE), ciclos, evidencias, certificados (idempotencia `parcela×ciclo`), alertas |
| `0004_tesoreria_embarques_saga.sql` | tesorerías (saldo = espejo del on-chain), movimientos (idempotencia por `tx_signature` y `helius_webhook_id`), embarques, embarque_parcelas, saga_certificacion |
| `0005_parametros_y_auditoria.sql` | parámetros globales/por cultivo (+seeds = valores de la maqueta), umbrales EUDR provisionales, auditoría genérica |
| `0006_rls_y_vista_publica.sql` | RLS en todas las tablas de dominio + vista `certificados_publicos` (único acceso `anon`) |
| `0007_endurecer_anon.sql` | Retira los grants por defecto de Supabase al rol `anon` (defensa en profundidad §7.1): solo la vista pública queda legible |

## Decisiones que conviene recordar

- **RLS aísla filas; NestJS autoriza acciones.** El backend usa `service_role` (omite RLS); estas políticas protegen el acceso directo del cliente (Realtime de alertas/saga, lecturas del agricultor). Los privilegios de sub-rol (`certificados.emitir`, etc.) se evalúan en NestJS, nunca en RLS (§7).
- **El agricultor solo escribe una cosa** por Supabase directo: `INSERT` en `ciclos_siembra` (declarar nueva siembra) sobre sus propias fincas.
- `lecturas_telemetria` nace **particionada** (convertirla después es una migración cara); el backend debe crear la partición del mes siguiente por cron. Particiones creadas: 2026-07 a 2026-09 + default.
- Montos en **micro-USDC (`BIGINT`)**, igual que el `u64` on-chain — nunca float.
- `tesorerias.saldo_cache` es espejo; la fuente de verdad es la cuenta ATA en Solana (webhook Helius).
- El guardarraíl `LAST_TEAM_ADMIN` es un trigger (no CHECK): depende de agregación entre filas. El código de error mapea a la clave i18n `team.last_admin` del frontend.
- Seeds incluidos: catálogo de 10 privilegios, 3 cultivos con HS code, tarifas (5/2 USDC), densidad de sensores (2 ha), vigencia 270 días y umbrales provisionales — espejo de los fixtures de la maqueta.

## Cómo aplicar

- **Vía MCP de Supabase (esta sesión de Claude Code):** `apply_migration` por archivo, en orden.
- **Vía CLI:** `supabase db push` con esta carpeta como `supabase/` del proyecto, o `psql -f` en orden.

Pendiente para cuando exista el backend: buckets de Storage (imágenes satelitales, PDFs), trigger de auditoría automática, y función/vista de inercia térmica sobre `lecturas_telemetria`.
