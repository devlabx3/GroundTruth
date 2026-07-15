# GroundTruth — Índice de Vistas y Navegación (v1)

> Mapa de rutas de toda la plataforma: qué existe, quién puede verlo, qué shell lo envuelve y qué componentes usa cada vista. Se deriva de `GroundTruth-Casos-de-Uso-por-Rol.md` y consume los componentes de `GroundTruth-Sistema-de-Diseno.md`.

### Estado de implementación

Contrastado contra el router y el árbol de componentes (julio 2026).

> ✅ **Las 37 rutas de este índice existen, una a una.** El router las implementa todas, con
> los guards en el orden del §2.1.
>
> ⚠️ **Lo que NO coincide es el inventario de componentes (§7):** el documento nombraba **una
> pieza por concepto** (`MetricCard`, `CostPreviewCard`, `SubRoleBuilder`, `StepErrorDetail`…).
> Se construyó con **menos componentes y más genéricos** (`Card`, `Table`, `Dialog`…), montados
> en cada vista. **Es mejor así**: menos superficie que mantener y menos abstracciones de un
> solo uso. Este documento se corrige para reflejar lo que existe, no al revés.

---

## 1. Estructura de rutas

```
/:locale/                          Público (Visitante) — sin guard
/:locale/verificar                 Público — sin guard
/:locale/verificar/:certId         Público — sin guard
/:locale/contacto                  Público — sin guard
/:locale/login                     Público — sin guard (redirige si ya hay sesión)

/:locale/dapp/...                  Guard: sesión + rol FARMER
/:locale/dashboard/...             Guard: sesión + rol OPERATOR (+ privilegio por sub-ruta)
/:locale/admin/...                 Guard: sesión + rol ADMIN
```

`:locale` = `es` por defecto (regla i18n); resto de idiomas se agregan como prefijo sin tocar el árbol de rutas. Un usuario con membresías en varias unidades o con rol `FARMER` adicional pasa por el **selector de contexto** antes de entrar a `/dashboard` o `/dapp` (§2.2).

---

## 2. Shells (layouts) por rol

✅ Los 4 shells existen. La navegación del Operador se filtra por privilegio con `PrivilegeGate`;
la del Admin no se filtra (máximo control).

| Shell | Usado en | Estructura |
| --- | --- | --- |
| `PublicShell` | Visitante | Header con logo + selector de idioma + CTA login, footer institucional |
| `DAppLiteShell` | Agricultor | Header simple + contenido de una columna, sin sidebar |
| `DashboardShell` | Operador | Sidebar (ítems filtrados por privilegio) + barra superior (saldo si `tesoreria.ver`) |
| `AdminShell` | Admin | Sidebar fijo + barra superior con salud de integraciones |

*(`SidebarNav`, `TopBar` y `NavHeader` no son componentes aparte: viven dentro de cada shell.)*

### 2.1 Guards (orden de evaluación)

1. ✅ **¿Hay sesión?** (`RequireSession`) No → redirige a `/:locale/login` conservando la ruta de retorno.
2. ✅ **¿El rol coincide con el shell?** (`RequireRole`) — pero ⚠️ **el rol se DERIVA**, no es una columna: *admin* si `es_admin`; *operator* si hay membresía activa **y el contexto activo es una unidad**; *farmer* si es dueño de una finca.
3. ✅ **(Solo Operador) ¿Tiene el privilegio de la sub-ruta?** (`RequirePrivilege`) No → pantalla de bloqueo. **El backend lo vuelve a comprobar**: ocultar el botón no es autorizar.

### 2.2 Selector de contexto

Se muestra antes del shell cuando el usuario tiene más de una membresía o combina `OPERATOR`+`FARMER`. Componente `ContextSwitcher`: lista de unidades/roles disponibles → selecciona → carga privilegios efectivos → entra al shell correspondiente. Accesible después también desde la barra superior del shell.

---

## 3. Índice de vistas — VISITANTE (`PublicShell`)

| Ruta | Vista | Caso de uso | Componentes principales | Datos |
| --- | --- | --- | --- | --- |
| `/:locale/` | Landing | V1 | Secciones de landing (montadas con `Card`/`Button`), `LanguageSwitcher` | Estático + metadatos SEO por locale |
| `/:locale/verificar` | Verificador | V2 | `Card`, tabs (número / asset ID / subir PDF), `StatusBadge`, `ExplorerLink` | ✅ `GET /public/certificates?q=&by=number\|asset\|hash` |
| `/:locale/verificar/:certId` | Verificador — **deep link del QR** | V2 | La misma vista, **precargada** | ✅ **La ruta existía pero IGNORABA el `:certId`**: escanear el QR impreso en el PDF abría un formulario vacío. Corregido: ahora la vista nace cargando y busca sola |
| `/:locale/contacto` | Solicitar demo | V3 | `Card`, `Input`, `Textarea`, `Button` | ⚠️ El formulario valida, pero **el lead no se persiste** en ninguna parte |
| `/:locale/login` | Iniciar sesión | V4 | `Card`, `Input`, `Button`, `ErrorInline` | ✅ Supabase Auth |

---

## 4. Índice de vistas — AGRICULTOR (`DAppLiteShell`, rol `FARMER`)

| Ruta | Vista | Caso de uso | Componentes principales | Datos |
| --- | --- | --- | --- | --- |
| `/:locale/dapp` | Inicio: alertas | F2 | `Card`, `EmptyState` | ⚠️ `GET /farmer/alertas` por **refetch**. El **Realtime no está implementado** (no hay `RealtimeIndicator`) |
| `/:locale/dapp/parcelas` | Mis parcelas | F3 | `Card` con `SoilCoreIndicator` + `StatusBadge`, `EmptyState` | TanStack Query `GET /farmer/parcelas` |
| `/:locale/dapp/parcelas/:id` | Detalle de parcela | F3, F4, F5 | `SoilCoreIndicator`, `StatusBadge`, `CycleHistoryList`, `Button` ("Declarar nueva siembra") | Query detalle + historial de ciclos |
| `/:locale/dapp/parcelas/:id/nueva-siembra` | Confirmar nueva siembra | F4 | `ConfirmDialog` → `OnchainProgressModal` (2 pasos) | ✅ `POST /farmer/parcelas/:id/nueva-siembra`. ⚠️ **Los 2 pasos NO tocan la cadena** (el estado del certificado vive off-chain): sus textos se corrigieron para no fingirlo |
| `/:locale/dapp/perfil` | Preferencias | F1 | `LanguageSwitcher`, `Button` (cerrar sesión) | — |

---

## 5. Índice de vistas — OPERADOR (`DashboardShell`, rol `OPERATOR`)

Cada fila indica el **privilegio** que habilita el ítem del sidebar (`PrivilegeGate`). Sin el privilegio, la vista no aparece en la navegación ni es accesible por URL directa.

| Ruta | Vista | Caso de uso | Privilegio | Componentes principales | Datos |
| --- | --- | --- | --- | --- | --- |
| `/:locale/dashboard` | Dashboard | O2 | (base, todo miembro) | `Card` ×3, `ParcelMap`, `TreasuryBalanceCard` | ⚠️ Query agregada. **Sin Realtime**: refetch |
| `/:locale/dashboard/tesoreria` | Tesorería | O3 | `tesoreria.ver` | `TreasuryBalanceCard`, `CopyButton`, `Table`, `ExplorerLink` | ✅ `GET /tesoreria`. ⚠️ **La dirección de depósito es el ATA, no la Treasury PDA.** La vista **reconcilia leyendo la cadena** al abrirse, y hay botón manual: no depende del webhook |
| `/:locale/dashboard/topologia` | Fincas y parcelas | O4 | `topologia.gestionar` | `Table` de parcelas, `SoilCoreIndicator`, `StatusBadge`, `Button` | Query lista |
| `/:locale/dashboard/topologia/nueva` | Nueva parcela | O4 | `topologia.gestionar` | `ParcelMap` (dibujo), `Select` (finca, cultivo), `AlertBanner` (gate) | ✅ `POST /topologia/parcelas`. **El gate de sensores y la validez del polígono los impone el SERVIDOR** con PostGIS; el navegador solo estima |
| `/:locale/dashboard/topologia/:id` | Detalle / editar parcela | O4, O6 | `topologia.gestionar` (edición) / `telemetria.ver` (lectura) | `ParcelMap`, `TelemetryChart` (Recharts), `SoilCoreIndicator`, `CycleHistoryList` | ⚠️ Query detalle. **Sin Realtime**: refetch |
| `/:locale/dashboard/agricultores` | Agricultores de la unidad | O5 | `agricultores.gestionar` | `Table`, `Dialog` (crear) | ⚠️ Crear un agricultor **crea su usuario y su finca**. No hay "vincular/reasignar". 🔴 **El agricultor creado aún no puede iniciar sesión** |
| `/:locale/dashboard/embarques` | Embarques | O7 | `embarques.preparar` | `Table` (estado: borrador / listo para aprobación / procesando / emitido), `StatusBadge`, `Button` (nuevo) | Query lista |
| `/:locale/dashboard/embarques/nuevo` | Preparar embarque | O7 | `embarques.preparar` | `Table` de parcelas elegibles, `Card` de costo | ✅ Costo leído de los **parámetros reales** |
| `/:locale/dashboard/embarques/:id` | Detalle de embarque | O7 | `embarques.preparar` / `certificados.emitir` | `Card` de costo, `OnchainProgressModal` (5 pasos) | ✅ `POST :id/certificar` — **saga de 3 fases**, UNA transacción on-chain. 🔜 **Sin `ApprovalPendingBanner`**: quien no tiene el privilegio recibe 403; el flujo de aprobación no existe. 🔜 **Sin suscripción al saga** (el modal no es recuperable si se cierra) |
| `/:locale/dashboard/certificados` | Certificados | O8 | `certificados.ver` | `Table`, `StatusBadge` | ✅ `GET /certificados` |
| `/:locale/dashboard/certificados/:id` | Detalle de certificado | O8 | `certificados.ver` (ver) / `certificados.revocar` (acción) | `HashCompareRow`, `ExplorerLink`, `ConfirmDialog` → `OnchainProgressModal` (2 pasos) | ✅ Detalle + revocar. ⚠️ Los 2 pasos **no tocan la cadena**: el estado vive off-chain |
| `/:locale/dashboard/equipo` | Equipo y sub-roles | O9 | `equipo.gestionar` | `Table`, `Dialog` (crear sub-rol con checklist de privilegios), `ConfirmDialog` | ✅ El guardarraíl **"nunca sin timón"** lo impone un **trigger de la base**. 🔜 Sin "invitar miembro" |
| `/:locale/dashboard/configuracion` | Perfil de la unidad | O10 | `unidad.configurar` | `Card`, `Input`, `Select` | ✅ `PATCH /unidad` (auditado) |

---

## 6. Índice de vistas — ADMIN (`AdminShell`, rol `ADMIN`)

| Ruta | Vista | Caso de uso | Componentes principales | Datos |
| --- | --- | --- | --- | --- |
| `/:locale/admin` | Panel global | A6 | `Card` ×4 + buscador transversal | ✅ Query agregada multi-unidad |
| `/:locale/admin/unidades` | Unidades de negocio | A1 | `Table`, `Button` | ✅ Estados: activa / suspendida / **pendiente on-chain** |
| `/:locale/admin/unidades/nueva` | Alta de unidad | A1 | `Card`, `OnchainProgressModal` (2 pasos) | ⚠️ **NO llama a `init_operator_treasury`.** Los 2 pasos son *crear la unidad + su sub-rol* y *sembrar al administrador*. La unidad nace `PENDIENTE_ONCHAIN` **sin tesorería** |
| `/:locale/admin/unidades/:id` | Detalle de unidad | A1 | `TreasuryBalanceCard`, `Table` de miembros, `Button` | ✅ **Suspender muerde**: la unidad no puede certificar. Si está `PENDIENTE_ONCHAIN`, **no hay tesorería que mostrar** y se dice |
| `/:locale/admin/privilegios` | Catálogo de privilegios | A2 | `Table`, `Dialog`, `ConfirmDialog` con el impacto (cuántos sub-roles lo usan) | ✅ Deprecar = **deja de asignarse**; quien lo tiene lo conserva |
| `/:locale/admin/usuarios` | Soporte de usuarios y membresías | A3 | `Table`, buscador, `Dialog`, `ConfirmDialog` | ✅ Desactivar respeta el guardarraíl **LAST_TEAM_ADMIN**. 🔴 Los usuarios creados **no pueden iniciar sesión** todavía |
| `/:locale/admin/parametros` | Parámetros del sistema | A4 | `Card` por sección + `Table` de bitácora | ✅ **No es decorativo**: el `certify` lee estas tarifas al cobrar. Cambios auditados con antes/después |
| `/:locale/admin/simulador` | Simulador IoT | A5 | `Table` de nodos, `Dialog` (perfil sano/degradado + horas) | ✅ **Genera telemetría real**, evaluada contra los umbrales de la base, y levanta la alerta que ve el agricultor |
| `/:locale/admin/supervision` | Supervisión global | A6 | `Table` con filtros y buscador | ✅ Query transversal |
| `/:locale/admin/saga` | Auditoría del saga | A7 | `Card` desplegable con el paso fallido, `Button` (reintentar) | ✅ El reintento **reusa el `certificar` del operador**: misma transacción, misma idempotencia. ⚠️ Sin Realtime |
| `/:locale/admin/certificados` | Revocación global | A8 | `Table`, `ConfirmDialog` (motivo) → `OnchainProgressModal` | ✅ **Reusa el `revocar` del operador**: una sola ruta de revocación. ⚠️ La revocación es **off-chain** (el cNFT es inmutable) |
| `/:locale/admin/integraciones` | Salud de integraciones | A9 | `Card` ×6 | ✅ **Pregunta a los servicios reales.** Sentinel y Helius se declaran `no_configurado` en vez de fingir un "ok" |

*A10 (rotación de keypair en KMS/HSM) es un runbook operativo, sin pantalla — según el propio catálogo de casos de uso.*

---

## 7. Inventario de componentes ✅

**Los que EXISTEN.** El documento anterior nombraba una pieza por concepto (`MetricCard`,
`CostPreviewCard`, `SubRoleBuilder`, `StepErrorDetail`, `Toast`…). Se construyó con **menos
componentes y más genéricos**, montados en cada vista. Es una simplificación deliberada: menos
superficie que mantener y ninguna abstracción de un solo uso.

### De dominio (`components/shared/`)

| Componente | Función |
| --- | --- |
| `SoilCoreIndicator` | Elemento de firma: 4 segmentos; el 4.º se pinta **oro** al emitirse el certificado |
| `OnchainProgressModal` | Progreso paso a paso. ⚠️ **Un paso nunca puede afirmar una escritura en cadena que no ocurre** — se corrigieron los de revocar y nueva siembra |
| `PrivilegeGate` | Oculta navegación y botones sin el privilegio. **No es autorización**: el backend lo vuelve a comprobar |
| `ContextSwitcher` | Cambio entre unidades, y entre Operador y Agricultor (una persona puede ser ambas) |
| `HashCompareRow` | Hash on-chain vs. hash calculado, con sello de coincidencia |
| `ExplorerLink` | Enlace al explorer de Solana: **verificación independiente** |
| `ParcelMap` | Leaflet: dibujo de polígono y pines de estado |
| `TreasuryBalanceCard` · `CycleHistoryList` · `LanguageSwitcher` | — |
| `AlertBanner` · `ErrorInline` | Patrones de error. ⚠️ **No hay `Toast`**: los errores se muestran inline o en banner |

### Genéricos (`components/ui/`)

`Button` · `Card` · `Table` · `Dialog` · `ConfirmDialog` · `Input` · `Select` · `Textarea` ·
`StatusBadge` · `EmptyState` · `Skeleton` · `CopyButton`

> **`Button`: los colores son del `variant`, nunca del `className`.** Pasar
> `className="bg-… text-…"` ya produjo un **botón invisible** (esmeralda sobre esmeralda);
> Tailwind resuelve el conflicto por el orden de la hoja de estilos, no por el del string.
> **Hay un test que lo vigila.**

## 8. Regla de consistencia

Ninguna vista nueva se agrega a este índice sin: (a) existir primero como caso de uso en `GroundTruth-Casos-de-Uso-por-Rol.md`, (b) declarar su privilegio si es del Operador, y (c) reutilizar componentes de §7 antes de crear uno nuevo. Si una vista necesita una acción on-chain, usa `OnchainProgressModal`; si necesita mostrar un error, usa la taxonomía de `GroundTruth-Gestion-de-Errores.md` — no se inventan patrones nuevos por pantalla.
