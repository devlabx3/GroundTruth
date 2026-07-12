# GroundTruth — Índice de Vistas y Navegación (v1)

> Mapa de rutas de toda la plataforma: qué existe, quién puede verlo, qué shell lo envuelve y qué componentes usa cada vista. Se deriva directamente de `GroundTruth-Casos-de-Uso-por-Rol.md` (una fila aquí por cada caso de uso — nada se agrega ni se omite) y consume los componentes de `GroundTruth-Sistema-de-Diseno.md`. Es la referencia para construir el router y para que ninguna pantalla se ensamble con componentes inconsistentes.

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

| Shell | Usado en | Estructura | Componentes de armazón |
| --- | --- | --- | --- |
| `PublicShell` | Visitante | Header con logo + selector de idioma + CTA login, footer institucional | `LanguageSwitcher`, `NavHeader` |
| `DAppLiteShell` | Agricultor | Header simple (logo + selector de idioma) + contenido de una columna, sin sidebar | `LanguageSwitcher`, `ContextSwitcher` (si aplica) |
| `DashboardShell` | Operador | Sidebar lateral (ítems filtrados por privilegio) + barra superior (saldo si `tesoreria.ver`, alertas, avatar) | `SidebarNav` (`PrivilegeGate` por ítem), `TopBar`, `ContextSwitcher` |
| `AdminShell` | Admin | Sidebar lateral (fijo, sin filtrado — máximo control) + barra superior (salud de integraciones resumida) | `SidebarNav`, `TopBar`, `IntegrationHealthBadge` |

### 2.1 Guards (orden de evaluación)

1. **¿Hay sesión?** No → redirige a `/:locale/login` conservando la ruta de retorno (`GroundTruth-Gestion-de-Errores.md` §4).
2. **¿El rol coincide con el shell?** No → bloqueo 403 y redirección a la superficie correcta del rol (p. ej. `FARMER` que entra a `/dashboard` → `/dapp`).
3. **(Solo Operador) ¿Tiene el privilegio de la sub-ruta?** No → la ruta no se renderiza; si se accede directo por URL, pantalla de bloqueo "No tienes acceso a esta sección."

### 2.2 Selector de contexto

Se muestra antes del shell cuando el usuario tiene más de una membresía o combina `OPERATOR`+`FARMER`. Componente `ContextSwitcher`: lista de unidades/roles disponibles → selecciona → carga privilegios efectivos → entra al shell correspondiente. Accesible después también desde el `TopBar`.

---

## 3. Índice de vistas — VISITANTE (`PublicShell`)

| Ruta | Vista | Caso de uso | Componentes principales | Datos |
| --- | --- | --- | --- | --- |
| `/:locale/` | Landing | V1 | `Hero`, `ValuePropSection`, `HowItWorksSection`, `CTASection`, `LanguageSwitcher` | Estático + metadatos SEO por locale |
| `/:locale/verificar` | Verificador — entrada | V2 | `Card`, `Tabs` (número / asset ID / subir PDF), `Input`, `FileDropzone`, `Button` | — |
| `/:locale/verificar/:certId` | Verificador — resultado | V2 | `CertificateVerifyCard`, `StatusBadge`, `HashCompareRow`, `ExplorerLink` | Query pública `GET /public/certificates/:id` |
| `/:locale/contacto` | Solicitar demo | V3 | `Form` (React Hook Form + Zod), `Input`, `Textarea`, `Button` | Mutación → lead |
| `/:locale/login` | Iniciar sesión | V4 | `Form`, `Input`, `Button`, `ErrorInline` | Supabase Auth |

---

## 4. Índice de vistas — AGRICULTOR (`DAppLiteShell`, rol `FARMER`)

| Ruta | Vista | Caso de uso | Componentes principales | Datos |
| --- | --- | --- | --- | --- |
| `/:locale/dapp` | Inicio: alertas | F2 | `AlertList`, `EmptyState`, `RealtimeIndicator` | Supabase Realtime (`alertas` de sus parcelas) |
| `/:locale/dapp/parcelas` | Mis parcelas | F3 | `ParcelListItem` (con `SoilCoreIndicator` + `StatusBadge`), `EmptyState` | TanStack Query `GET /farmer/parcelas` |
| `/:locale/dapp/parcelas/:id` | Detalle de parcela | F3, F4, F5 | `SoilCoreIndicator`, `StatusBadge`, `CycleHistoryList`, `Button` ("Declarar nueva siembra") | Query detalle + historial de ciclos |
| `/:locale/dapp/parcelas/:id/nueva-siembra` | Confirmar nueva siembra | F4 | `ConfirmDialog` (consecuencias explícitas) → `OnchainProgressModal` (2 pasos) | Mutación `POST .../nueva-siembra` |
| `/:locale/dapp/perfil` | Preferencias | F1 | `LanguageSwitcher`, `Button` (cerrar sesión) | — |

---

## 5. Índice de vistas — OPERADOR (`DashboardShell`, rol `OPERATOR`)

Cada fila indica el **privilegio** que habilita el ítem del sidebar (`PrivilegeGate`). Sin el privilegio, la vista no aparece en la navegación ni es accesible por URL directa.

| Ruta | Vista | Caso de uso | Privilegio | Componentes principales | Datos |
| --- | --- | --- | --- | --- | --- |
| `/:locale/dashboard` | Dashboard | O2 | (base, todo miembro) | `MetricCard` ×3, `ParcelMap` (Leaflet, pines verde/rojo), `TreasuryBalanceCard` (si `tesoreria.ver`) | Query agregada + Realtime estado de parcelas |
| `/:locale/dashboard/tesoreria` | Tesorería | O3 | `tesoreria.ver` | `TreasuryBalanceCard`, `CopyAddressButton`, `DepositInstructions`, `Table` (historial) | Query saldo + movimientos; webhook Helius vía Realtime |
| `/:locale/dashboard/topologia` | Fincas y parcelas | O4 | `topologia.gestionar` | `Table`/`CardGrid` de parcelas, `SoilCoreIndicator`, `StatusBadge`, `Button` (nueva parcela) | Query lista |
| `/:locale/dashboard/topologia/nueva` | Nueva parcela | O4 | `topologia.gestionar` | `ParcelMap` (modo dibujo), `CropSelect`, `SensorCoverageGate` (bloqueo inline), `NodeAssignPanel` | Mutación crear + validación de polígono |
| `/:locale/dashboard/topologia/:id` | Detalle / editar parcela | O4, O6 | `topologia.gestionar` (edición) / `telemetria.ver` (lectura) | `ParcelMap`, `TelemetryChart` (Recharts: pH, EC, humedad, temp ×2), `SoilCoreIndicator`, `CycleHistoryList` | Query detalle + Realtime telemetría |
| `/:locale/dashboard/agricultores` | Agricultores de la unidad | O5 | `agricultores.gestionar` | `Table`, `Dialog` (crear/vincular), `ConfirmDialog` (reasignar) | Query + mutaciones |
| `/:locale/dashboard/embarques` | Embarques | O7 | `embarques.preparar` | `Table` (estado: borrador / listo para aprobación / procesando / emitido), `StatusBadge`, `Button` (nuevo) | Query lista |
| `/:locale/dashboard/embarques/nuevo` | Preparar embarque | O7 | `embarques.preparar` | `ParcelPicker` (filtra por cultivo/estado), `CultivarMismatchWarning`, `CostPreviewCard` | Query parcelas elegibles + cálculo de costo |
| `/:locale/dashboard/embarques/:id` | Detalle de embarque | O7 | `embarques.preparar` (ver) / `certificados.emitir` (ejecutar) | `CostPreviewCard`, `Button` ("Generar certificado" — solo con privilegio; si no, `ApprovalPendingBanner`), `OnchainProgressModal` (5 pasos) | Mutación certify + suscripción a estado del saga |
| `/:locale/dashboard/certificados` | Certificados | O8 | `certificados.ver` | `Table`, `StatusBadge` | Query lista |
| `/:locale/dashboard/certificados/:id` | Detalle de certificado | O8 | `certificados.ver` (ver) / `certificados.revocar` (acción) | `HashCompareRow`, `ExplorerLink`, `Button` ("Revocar" con `ConfirmDialog` de motivo) → `OnchainProgressModal` (2 pasos) | Query detalle + mutación revocar |
| `/:locale/dashboard/equipo` | Equipo y sub-roles | O9 | `equipo.gestionar` | `Table` de miembros, `SubRoleBuilder` (checklist de privilegios del catálogo), `SensitivePrivilegeConfirm`, `ConfirmDialog` (último admin / eliminar sub-rol en uso) | Query miembros/sub-roles + mutaciones |
| `/:locale/dashboard/configuracion` | Perfil de la unidad | O10 | `unidad.configurar` | `Form`, `LanguageSwitcher` | Mutación |

---

## 6. Índice de vistas — ADMIN (`AdminShell`, rol `ADMIN`)

| Ruta | Vista | Caso de uso | Componentes principales | Datos |
| --- | --- | --- | --- | --- |
| `/:locale/admin` | Panel global | A6 | `MetricCard` ×N, `GlobalSearch` | Query agregada multi-unidad |
| `/:locale/admin/unidades` | Unidades de negocio | A1 | `Table`, `Button` (alta) | Query lista |
| `/:locale/admin/unidades/nueva` | Alta de unidad | A1 | `Form`, `OnchainProgressModal` (2 pasos: Treasury + siembra de administrador) | Mutación `init_operator_treasury` |
| `/:locale/admin/unidades/:id` | Detalle de unidad | A1 | `TreasuryBalanceCard` (solo lectura), `Table` (miembros, solo lectura), `Button` (suspender) | Query detalle |
| `/:locale/admin/privilegios` | Catálogo de privilegios | A2 | `Table`, `Dialog` (agregar privilegio), `ImpactWarningDialog` (deprecar) | Query + mutaciones |
| `/:locale/admin/usuarios` | Soporte de usuarios y membresías | A3 | `Table`, `SearchInput`, `Dialog` (crear/desactivar), `ConfirmDialog` (auditado) | Query + mutaciones |
| `/:locale/admin/parametros` | Parámetros del sistema | A4 | `Form` agrupado por sección (tarifas / umbrales / vigencia / sensores), `AuditLogTable` | Query + mutaciones versionadas |
| `/:locale/admin/simulador` | Simulador IoT | A5 | `NodeControlPanel`, `ProfileSelect` (sano/degradado), `Button` (inyectar anomalía) | Mutaciones sobre nodos simulados |
| `/:locale/admin/supervision` | Supervisión global | A6 | `Table` con filtros (unidad, cultivo, estado), `GlobalSearch` | Query transversal |
| `/:locale/admin/saga` | Auditoría del saga | A7 | `Table` (cola `CERT_PENDING`/`FAILED`), `StepErrorDetail`, `Button` (reintentar) | Query + Realtime estado de sagas |
| `/:locale/admin/certificados` | Revocación global | A8 | `Table`, `Button` ("Revocar" con `ConfirmDialog`) → `OnchainProgressModal` | Query + mutación |
| `/:locale/admin/integraciones` | Salud de integraciones | A9 | `IntegrationStatusCard` ×5 (Sentinel Hub, Helius, Irys/Arweave, RPC Solana, Supabase), `AlertBanner` | Polling de estado |

*A10 (rotación de keypair en KMS/HSM) es un runbook operativo, sin pantalla — según el propio catálogo de casos de uso.*

---

## 7. Inventario de componentes compartidos

Componentes que aparecen en más de una vista o rol — se construyen una sola vez.

| Componente | Rol(es) que lo usan | Función |
| --- | --- | --- |
| `SoilCoreIndicator` | Agricultor, Operador | Elemento de firma: estado/progreso en 4 segmentos (§4 del sistema de diseño) |
| `OnchainProgressModal` | Agricultor, Operador, Admin | Progreso paso a paso de toda acción on-chain (§7 del sistema de diseño) |
| `StatusBadge` | Los 4 roles | Pill de estado: Conforme (esmeralda) / Alerta o Revocado (lacre) / Pendiente (ámbar neutro) |
| `LanguageSwitcher` | Los 4 roles | Selector de idioma persistente (regla i18n) |
| `ContextSwitcher` | Agricultor, Operador | Cambio entre membresías / entre rol Operador y Farmer |
| `PrivilegeGate` | Operador | Envuelve ítems de navegación y botones; oculta si falta el privilegio |
| `ConfirmDialog` | Los 4 roles | Confirmación con consecuencias explícitas en texto (obligatoria en toda acción sensible, ver notas transversales de casos de uso) |
| `ParcelMap` | Operador (dibujo), Visitante (no aplica — el mapa detallado no es público) | Leaflet: dibujo de polígono + pines de estado |
| `TelemetryChart` | Operador | Recharts: series de pH/EC/humedad/temperatura |
| `HashCompareRow` | Visitante (verificador), Operador (detalle certificado) | Muestra hash on-chain vs. hash calculado, con sello de coincidencia |
| `ExplorerLink` | Visitante, Operador, Admin | Enlace al explorer de Solana para verificación independiente |
| `EmptyState` | Los 4 roles | Estado vacío con invitación a la acción (regla de copy) |
| `ErrorInline` / `AlertBanner` / `Toast` | Los 4 roles | Patrones de presentación de error (§3 de gestión de errores) |

---

## 8. Regla de consistencia

Ninguna vista nueva se agrega a este índice sin: (a) existir primero como caso de uso en `GroundTruth-Casos-de-Uso-por-Rol.md`, (b) declarar su privilegio si es del Operador, y (c) reutilizar componentes de §7 antes de crear uno nuevo. Si una vista necesita una acción on-chain, usa `OnchainProgressModal`; si necesita mostrar un error, usa la taxonomía de `GroundTruth-Gestion-de-Errores.md` — no se inventan patrones nuevos por pantalla.
