# GroundTruth — Gestión de Errores (v1)

> Catálogo de referencia para el equipo. Define **cómo se clasifican, se muestran y se recuperan** los errores en toda la plataforma. Base directa del desarrollo de UI y del manejo de excepciones en NestJS. Se apoya en los casos de uso por rol y en el sistema de diseño (paleta lacre para error, componente `OnchainProgressModal`).

### Estado de implementación

Contrastado contra el código (julio 2026): ✅ existe · ⚠️ existe con divergencia · 🔜 no existe, sigue en pie.

> **El contrato de errores está protegido por un test.** Cada `messageKey` que devuelve el
> backend tiene su traducción en los 7 idiomas, y un test del backend lo verifica. Sin él,
> renombrar una clave le enseñaría `insufficient_funds` en crudo a un agricultor.

---

## 1. Principios

1. **Decir qué pasó y qué hacer**, en una frase, sin prefijo "Error:" ni jerga técnica ni primera persona.
2. **El error se muestra donde ocurre:** validación de campo → inline junto al campo; fallo de una operación → en su modal/contexto; fallo global → banner. Nunca un `alert()` genérico.
3. **Nunca exponer la excepción cruda** (stack, mensaje de Postgres, error de RPC de Solana) al usuario. Se registra en observabilidad; al usuario se le da el mensaje traducido del catálogo.
4. **Preservar el trabajo del usuario:** un error no vacía un formulario ni pierde una selección de parcelas.
5. **Idempotencia sobre reintento:** ninguna acción con efecto económico u on-chain ofrece un reintento que pueda duplicar cobro o mint.
6. **Todo mensaje es una clave i18n**; los datos técnicos (hash, tx id, monto) se interpolan pero no se traducen.
7. **Degradar, no romper:** si una integración no crítica cae (p. ej. Realtime), la app sigue usable en modo degradado con aviso, no pantalla en blanco.

---

## 2. Taxonomía de errores

| Clase | Origen | Presentación | Recuperación |
| --- | --- | --- | --- |
| **Validación** | Entrada del usuario (Zod front + back) | Inline junto al campo | Corregir y reenviar |
| **Autenticación/Autorización** | 401 / 403 | Redirección o bloqueo de acción | Re-login / solicitar privilegio |
| **Regla de negocio** | Backend rechaza por invariante del dominio | Inline en el contexto de la acción | Ajustar la operación |
| **Saga on-chain** | Fallo en un paso de certificación/tx | Paso en lacre dentro de `OnchainProgressModal` | Reintento idempotente |
| **Integración externa** | Sentinel Hub, Helius, Arweave/Irys, RPC | Aviso contextual + reintento programado | Automático (saga) o manual |
| **Red/Cliente** | Timeout, offline, 5xx | Toast/banner con reintentar | Reintentar |
| **No encontrado** | 404 de recurso | Estado vacío específico | Navegar a un lugar válido |
| **Sistema** | 500 inesperado | Banner genérico + id de incidencia | Reportar / reintentar |

---

## 3. Patrones de presentación

- **Inline de campo:** texto lacre bajo el input, borde del input en lacre, icono `alert-circle`. Para validación y reglas de negocio atadas a un campo.
- **Banner de sección:** franja lacre suave (`sealwax-100 #F7E8EA` con texto `#6E1423`) arriba del contenido afectado. Para errores que afectan una vista completa (p. ej. integración caída).
- **Toast:** efímero (5 s) para errores transitorios de red no bloqueantes; con acción "Reintentar" si aplica. Nunca para errores que exigen decisión.
- **Paso en `OnchainProgressModal`:** para cualquier fallo de la saga. El paso se pinta lacre con motivo + acción.
- **Estado vacío:** para 404/sin datos; invitación a la acción, no disculpa.
- **Pantalla de bloqueo:** solo para 403 de ruta completa (rol sin acceso) y sesión expirada.

**Nunca:** `alert()`/`confirm()` del navegador, mensajes que culpan al usuario, spinners infinitos sin timeout, ni cerrar un modal a mitad de una operación on-chain.

---

## 4. Errores transversales (todos los roles)

| Situación | Clase | Mensaje (es, base) | Comportamiento |
| --- | --- | --- | --- |
| Sesión expirada (401) | Auth | "Tu sesión expiró. Inicia sesión de nuevo." | Redirige a login conservando la ruta de retorno |
| Acceso a ruta sin permiso (403 rol) | Authz | "No tienes acceso a esta sección." | Pantalla de bloqueo; enlace a su inicio según rol |
| Acción sin privilegio (403 sub-rol) | Authz | "Tu rol no permite esta acción. Solicítala a un administrador de tu unidad." | La acción no se muestra; si se fuerza vía API, se bloquea |
| Sin conexión / offline | Red | "Sin conexión. Revisa tu internet." | Banner persistente; reintenta al volver |
| Timeout de petición | Red | "La operación tardó demasiado. Reintenta." | Toast + reintentar; no re-ejecuta si ya se envió on-chain |
| 500 inesperado | Sistema | "Algo salió mal de nuestro lado. Intenta de nuevo en unos minutos." | Banner + id de incidencia para soporte |
| ✅ Realtime caído | Integración | "Sin actualización en vivo. Reintentando…" | Implementado: `RealtimeIndicator` pinta el estado real del canal y la app sigue por *refetch* (degradar, no romper). |
| Recurso no encontrado (404) | No encontrado | Estado vacío específico del recurso | Navegación a lugar válido |
| Idioma/diccionario faltante | Sistema | Cae al idioma por defecto (es) sin romper | Silencioso; se registra la clave faltante |

---

## 5. Errores por dominio

### 5.1 Autenticación y cuentas

| Situación | Mensaje (es, base) | Presentación |
| --- | --- | --- |
| Credenciales inválidas | "Correo o contraseña incorrectos." | Inline |
| Rol equivocado para la superficie (FARMER en dashboard) | "Esta cuenta usa la app del agricultor." | Bloqueo + redirección a DApp lite |
| Cuenta desactivada | "Tu cuenta está inactiva. Contacta a tu administrador." | Bloqueo |
| Usuario ya existe (alta) | "Ya existe una cuenta con este correo." | Inline |

### 5.2 Tesorería y depósitos

| Situación | Mensaje (es, base) | Presentación |
| --- | --- | --- |
| ⚠️ Depósito en red equivocada | "Solo se aceptan USDC por la red Solana." | **No es detectable, y no hace falta:** un depósito en otra cadena **nunca llega** a nuestro ATA. El aviso es preventivo en la vista, no un error. |
| ✅ Saldo insuficiente al certificar | "Fondos insuficientes en la tesorería. Deposita USDC para continuar." | Paso en lacre + botón "Ir a Tesorería". `TREASURY_INSUFFICIENT_FUNDS`, **reintentable** |
| ✅ Depósito no reflejado | "Tu depósito puede tardar unos minutos en reflejarse." | Aviso informativo. **La cadena es la fuente de verdad**: hay un botón de reconciliación manual, y la vista reconcilia al abrirse. No depende del webhook |

### 5.3 Topología (fincas, parcelas, sensores)

| Situación | Mensaje (es, base) | Presentación |
| --- | --- | --- |
| ✅ Polígono inválido (auto-intersección / área cero) | "El polígono no es válido: revisa que los vértices no se crucen." | Inline en el mapa. `INVALID_POLYGON`, validado con `ST_IsValid` en PostGIS |
| ✅ Cobertura de sensores insuficiente | "Esta parcela requiere {{n}} sensores para su área." | Inline + gate. **`SENSOR_COVERAGE_UNMET` lo impone el SERVIDOR** con el área de PostGIS, y **el `n` viaja en `details`**: el del navegador es una estimación y no coincide |
| ✅ Cultivo no especificado / desconocido | "Selecciona el cultivo de la parcela." | Inline. `CROP_UNKNOWN` |
| 🔜 Finca ya vinculada a otro agricultor | "Esta finca ya tiene un agricultor. ¿Reasignar?" | **No existe**: crear un agricultor crea su finca; no hay vincular/desvincular |

### 5.4 Embarque y certificación (saga)

| Paso / situación | Mensaje (es, base) | Presentación | Recuperación |
| --- | --- | --- | --- |
| ✅ Cultivos mezclados | "Todas las parcelas del embarque deben ser del mismo cultivo." | Inline en selección | `CROP_MISMATCH` |
| ✅ Parcela en rojo | "Una parcela tiene una anomalía y no puede certificarse." | Inline | `PARCEL_ANOMALY` |
| ✅ **Parcela sin siembra declarada** | "Esta parcela no tiene un ciclo de siembra activo." | Inline | `NO_ACTIVE_CYCLE`. *(No estaba en este documento.)* |
| ✅ **Unidad suspendida o pendiente on-chain** | "La unidad está suspendida: no puede emitir certificados." | Bloqueo | `UNIT_NOT_ACTIVE`. **La suspensión del Admin muerde de verdad.** *(No estaba en este documento.)* |
| 🔜 Sin privilegio para emitir | "El embarque queda listo para aprobación." | **No implementado.** Hoy simplemente devuelve **403 `NO_PRIVILEGE`**: el estado `LISTO_APROBACION` existe en la base pero ninguna transición lo usa |
| ⚠️ Falla la evidencia satelital | — | **No hay reintento con backoff.** Sin credenciales de Sentinel, **el certificado se emite igual, con el hash de la imagen en ceros**. No se inventa un hash y no se bloquea la emisión (degradar, no romper) |
| ✅ Falla la subida a Arweave | "No se pudo anclar la evidencia permanente." | El URI cae a una referencia interna; la emisión continúa | Degradación, no fallo |
| ✅ Falla la TX de Solana | "La transacción no se confirmó. Reintenta sin riesgo de doble cobro." | Paso en lacre + reintentar | `ONCHAIN_FAILED` (reintentable). **Si la cadena falla, NO se cobra nada**: el embarque vuelve a `BORRADOR` y el saga queda `FAILED` |
| ✅ Fondos insuficientes | "Fondos insuficientes en la tesorería." | Paso en lacre + "Ir a Tesorería" | `TREASURY_INSUFFICIENT_FUNDS` |
| ✅ Certificado ya existente on-chain | (silencioso) se **reconcilia**: su asset ID se lee de la cadena | — | El reintento **nunca duplica** cobro ni mint |

### 5.5 Agricultor (DApp lite)

| Situación | Mensaje (es, base) | Presentación |
| --- | --- | --- |
| ✅ Nueva siembra con certificación en curso | "Hay una certificación en proceso para esta parcela. Inténtalo en unos minutos." | Bloqueo. `CERTIFICATION_IN_PROGRESS`. **No es un detalle:** el `certify` ya capturó el ciclo actual, así que cerrarlo ahora haría que el operador **pagase un cNFT para un ciclo obsoleto** |
| ✅ Nueva siembra duplicada reciente (<24 h) | "Ya declaraste una siembra recientemente." | Inline. `PLANTING_DUPLICATE` — declarar siembra **obliga a re-certificar y cobra**, así que un doble clic no puede quemar un ciclo |
| ✅ Parcela sin ciclo activo | "Esta parcela no tiene un ciclo de siembra activo." | Bloqueo. `NO_ACTIVE_CYCLE` |

### 5.6 Gestión de equipo y sub-roles (Operador)

| Situación | Mensaje (es, base) | Presentación |
| --- | --- | --- |
| ✅ Último miembro con gestión de equipo | "La unidad no puede quedarse sin administración." | Bloqueo. `LAST_TEAM_ADMIN` — **lo impone un trigger de la base de datos**, no solo la aplicación; y también al desactivar un usuario desde el Admin |
| ✅ Eliminar sub-rol en uso | "Este sub-rol está asignado a miembros." | Bloqueo. `SUBROLE_IN_USE` |
| Asignar privilegio sensible (emitir/revocar) | "Este sub-rol podrá debitar la tesorería. ¿Confirmas?" | Confirmación explícita (auditada) |
| 🔜 Invitar a alguien que ya es miembro | "Esta persona ya pertenece a la unidad." | **No existe flujo de invitación.** Y los usuarios que crea el Admin **no pueden iniciar sesión todavía** (`auth_user_id` de relleno) |
| ✅ Sub-rol con nombre repetido | "Ya existe un sub-rol con ese nombre." | Inline. `SUBROLE_EXISTS` |
| ✅ Asignar un privilegio deprecado | "Ese privilegio está deprecado y ya no puede asignarse." | Inline. `PRIVILEGE_DEPRECATED` — quien ya lo tiene lo conserva; no se rompe a nadie en caliente |

### 5.7 Verificador público (Visitante) ✅

| Situación | Mensaje (es, base) | Presentación |
| --- | --- | --- |
| ✅ Certificado no encontrado | "No existe un certificado con ese identificador." | Estado vacío. `CERT_NOT_FOUND` |
| ✅ Documento PDF no coincide | "Este documento no coincide con el certificado en cadena." | Sello lacre. *El SHA-256 se calcula **en el navegador**: el documento nunca sale de la máquina de quien verifica* |
| ✅ Documento PDF íntegro | "Documento verificado: coincide con el registro en cadena." | Sello verde |
| ✅ Rate limit excedido | "Demasiadas consultas. Intenta de nuevo en un momento." | Aviso. `RATE_LIMITED` (30/min por IP) — sin freno, cualquiera podría **enumerar quién exporta qué y desde dónde** |
| ✅ Certificado revocado | "Este certificado fue revocado el [fecha]. No es válido para despacho." | Aviso destacado en la ficha |

### 5.8 Admin

| Situación | Mensaje (es, base) | Presentación |
| --- | --- | --- |
| ⚠️ Alta de unidad | — | **No hay "falla al crear Treasury": el alta NO la crea.** La unidad nace `PENDIENTE_ONCHAIN` a propósito; su tesorería es una cuenta on-chain que se crea aparte |
| ✅ Parámetro fuera de rango | "Valor fuera del rango permitido." | Inline. `PARAM_OUT_OF_RANGE` — valida min < max y rangos plausibles (pH 0–14, humedad 0–100) |
| ✅ Privilegio ya existente | "Ya existe un privilegio con esa clave." | Inline. `PRIVILEGE_EXISTS` |
| ✅ Certificado no revocable | "Este certificado no está vigente." | Bloqueo. `CERT_NOT_REVOCABLE` |
| 🔜 Balance de Irys/Arweave bajo | "El saldo para almacenamiento permanente está bajo." | **No se comprueba.** La clave `irys_low` existe, sin usar |
| ⚠️ Sentinel Hub caído / sin credenciales | — | **Las certificaciones NO se pausan**: se emite sin imagen y con su hash en ceros. El panel de integraciones lo declara `no_configurado` en vez de fingir un "ok" |
| 🔜 Unidad sin administrador (rescate) | — | **No existe** la intervención de rescate |

---

## 6. Manejo en el backend (NestJS)

✅ **Filtro de excepciones global.** Toda excepción sale con la forma estable
**`{ code, messageKey, retryable, details?, incidentId? }`**. El front nunca ve el stack, ni un
mensaje de Postgres, ni un error de RPC de Solana.

- `retryable` **es parte del contrato** (no estaba en este documento): dice si la UI puede
  ofrecer un reintento. Fondos insuficientes → `true` (se resuelve depositando); falta de
  privilegio → `false` (reintentar no lo arregla).
- `details` transporta las **interpolaciones que calcula el servidor** (p. ej. `{ n: 6 }`
  sensores). Sin ellas, la UI mostraría su propia estimación, que no coincide.
- Los `ZodError` de validación se mapean a `400 VALIDATION` / `field_required`.

✅ **26 códigos de dominio**, mapeados 1:1 a claves i18n. La UI decide la presentación según la
taxonomía (§2):

`ACCOUNT_INACTIVE` · `CERTIFICATION_IN_PROGRESS` · `CERT_ALREADY_EXISTS` · `CERT_NOT_FOUND` ·
`CERT_NOT_REVOCABLE` · `CROP_MISMATCH` · `CROP_UNKNOWN` · `INVALID_POLYGON` · `LAST_TEAM_ADMIN` ·
`NO_ACTIVE_CYCLE` · `NO_PRIVILEGE` · `NOT_FOUND` · `ONCHAIN_FAILED` · `PARAM_OUT_OF_RANGE` ·
`PARCEL_ANOMALY` · `PLANTING_DUPLICATE` · `PRIVILEGE_DEPRECATED` · `PRIVILEGE_EXISTS` ·
`RATE_LIMITED` · `SENSOR_COVERAGE_UNMET` · `SUBROLE_EXISTS` · `SUBROLE_IN_USE` ·
`TREASURY_INSUFFICIENT_FUNDS` · `UNIT_NOT_ACTIVE` · `USER_EXISTS` · `USER_NOT_PROVISIONED`

⚠️ **Idempotencia (corregido).** No se usa un `certificate_id` como decía este documento: la
llave es la **PDA `["cert", parcela_id, ciclo_id]`**. La cuenta se crea con `init`, así que un
segundo `certify` **falla en la creación de la cuenta**: la propia cadena impide el doble cobro
y el doble mint, sin que el programa tenga que comprobar nada. **Verificado on-chain.**

⚠️ **Los errores de la saga NO llevan `step`.** El paso fallido se guarda en
`saga_certificacion.paso_actual`, que es lo que consume la vista del Admin; el modal del
operador pinta en lacre el paso que estaba activo.

🔜 **Integraciones externas: no hay reintento con backoff.** Hoy **degradan** (sin Sentinel,
el certificado se emite sin imagen y con su hash en ceros) o **fallan de forma reintentable**
(la cadena). El reintento lo dispara una persona desde el Admin, no un scheduler.

⚠️ **Observabilidad:** el `incidentId` se genera y se devuelve al usuario, pero **no hay
plataforma de observabilidad conectada**: hoy solo se escribe al log del proceso.

---

## 7. Checklist por pantalla (para desarrollo)

Cada pantalla debe definir, antes de darse por terminada:

1. Estados de **carga** (skeleton, no spinner infinito).
2. Estado **vacío** (invitación a la acción).
3. Errores de **validación** de cada campo.
4. Errores de **regla de negocio** aplicables.
5. Comportamiento ante **401/403/404/500**.
6. Comportamiento ante **integración caída** (modo degradado).
7. Todas las cadenas como **claves i18n** (incluidos los errores).
