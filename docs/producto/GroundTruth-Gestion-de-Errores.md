# GroundTruth — Gestión de Errores (v1)

> Catálogo de referencia para el equipo. Define **cómo se clasifican, se muestran y se recuperan** los errores en toda la plataforma. Base directa del desarrollo de UI y del manejo de excepciones en NestJS. Se apoya en los casos de uso por rol y en el sistema de diseño (paleta lacre para error, componente `OnchainProgressModal`).

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
| Realtime caído | Integración | "Sin actualización en vivo. Reintentando…" | Modo degradado: datos por fetch manual; se restablece solo |
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
| Depósito en red equivocada | "Solo se aceptan USDC por la red Solana." | Banner en Tesorería |
| Saldo insuficiente al certificar | "Fondos insuficientes en la tesorería. Deposita USDC para continuar." | Paso en modal + botón "Ir a Tesorería" |
| Webhook de depósito demorado | "Tu depósito puede tardar unos minutos en reflejarse." | Aviso informativo (no error) |

### 5.3 Topología (fincas, parcelas, sensores)

| Situación | Mensaje (es, base) | Presentación |
| --- | --- | --- |
| Polígono inválido (auto-intersección / área cero) | "El polígono no es válido. Revisa los vértices." | Inline en el mapa |
| Cobertura de sensores insuficiente | "Esta parcela requiere N sensores para su área." | Inline + bloqueo de guardado (gate) |
| Cultivo no especificado | "Selecciona el cultivo de la parcela." | Inline |
| Finca ya vinculada a otro agricultor | "Esta finca ya tiene un agricultor. ¿Reasignar?" | Confirmación (queda auditada) |

### 5.4 Embarque y certificación (saga)

| Paso / situación | Mensaje (es, base) | Presentación | Recuperación |
| --- | --- | --- | --- |
| Cultivos mezclados en el embarque | "Todas las parcelas del embarque deben ser del mismo cultivo." | Inline en selección | Ajustar selección |
| Parcela en rojo seleccionada | "Una parcela tiene una anomalía y no puede certificarse." | Inline | Quitarla del embarque |
| Sin privilegio para emitir | "No puedes generar certificados. El embarque queda listo para aprobación." | Aviso + cambio de estado a "listo para aprobación" | Notifica a quien tiene el privilegio |
| Falla descarga satelital (Sentinel Hub) | "No se pudo obtener la imagen satelital. Reintentando automáticamente." | Paso en lacre → vuelve a activo | Reintento programado (embarque PENDIENTE) |
| Falla subida a Arweave | "No se pudo anclar la evidencia permanente. Reintentando." | Paso en lacre | Reintento idempotente (sin doble costo) |
| Falla TX Solana (red) | "La transacción no se confirmó. Reintenta sin riesgo de doble cobro." | Paso en lacre + reintentar | Idempotente (`CertificateRecord`) |
| Fondos insuficientes en TX | "Fondos insuficientes en la tesorería." | Paso en lacre + "Ir a Tesorería" | Depositar y reintentar |
| Certificado ya existente (mismo ciclo) | (silencioso) se reutiliza el cNFT vigente | — | Continúa la saga |

### 5.5 Agricultor (DApp lite)

| Situación | Mensaje (es, base) | Presentación |
| --- | --- | --- |
| Nueva siembra con certificación en curso | "Hay una certificación en proceso para esta parcela. Intenta más tarde." | Bloqueo de la acción |
| Nueva siembra duplicada reciente | "Ya declaraste una siembra recientemente. Contacta a tu operador si fue un error." | Inline |
| Fallo al registrar nueva siembra | "No se pudo registrar la nueva siembra. Reintenta." | Paso en modal + reintentar |

### 5.6 Gestión de equipo y sub-roles (Operador)

| Situación | Mensaje (es, base) | Presentación |
| --- | --- | --- |
| Último miembro con gestión de equipo | "La unidad no puede quedarse sin administración. Asigna el privilegio a otro miembro primero." | Bloqueo |
| Eliminar sub-rol en uso | "Este sub-rol está asignado a miembros. Reasígnalos antes de eliminarlo." | Bloqueo |
| Asignar privilegio sensible (emitir/revocar) | "Este sub-rol podrá debitar la tesorería. ¿Confirmas?" | Confirmación explícita (auditada) |
| Invitar a alguien que ya es miembro | "Esta persona ya pertenece a la unidad. Cambia su sub-rol." | Inline |

### 5.7 Verificador público (Visitante)

| Situación | Mensaje (es, base) | Presentación |
| --- | --- | --- |
| Certificado no encontrado | "No existe un certificado con ese identificador." | Estado vacío en el verificador |
| Documento PDF no coincide | "Este documento no coincide con el certificado en cadena. Podría estar alterado." | Sello lacre + explicación |
| Documento PDF íntegro | "Documento verificado: coincide con el registro en cadena." | Sello verde |
| Rate limit excedido | "Demasiadas consultas. Intenta de nuevo en un momento." | Aviso |
| Certificado revocado | "Este certificado fue revocado el [fecha]. No es válido para despacho." | Aviso destacado en la ficha |

### 5.8 Admin

| Situación | Mensaje (es, base) | Presentación |
| --- | --- | --- |
| Falla al crear Treasury (alta de unidad) | "No se pudo crear la tesorería en cadena. La unidad queda pendiente; reintenta." | Estado PENDIENTE_ONCHAIN + reintentar |
| Parámetro fuera de rango | "Valor fuera del rango permitido." | Inline |
| Balance de Irys/Arweave bajo | "El saldo para almacenamiento permanente está bajo. Fondéalo o las certificaciones fallarán." | Banner de alerta en salud de integraciones |
| Sentinel Hub / OAuth caído | "La conexión con el proveedor satelital está caída. Las certificaciones se pausarán." | Banner de alerta |
| Unidad sin administrador (rescate) | "Esta unidad no tiene administración activa. Reasignar es una intervención auditada." | Confirmación de soporte |

---

## 6. Manejo en el backend (NestJS)

- **Filtro de excepciones global** que traduce toda excepción a una forma estable: `{ code, messageKey, details?, incidentId? }`. El front nunca ve el stack.
- **Códigos de dominio** propios (p. ej. `TREASURY_INSUFFICIENT_FUNDS`, `SENSOR_COVERAGE_UNMET`, `CROP_MISMATCH`, `CERT_ALREADY_EXISTS`, `LAST_TEAM_ADMIN`) mapeados 1:1 a claves i18n del front. La UI decide la presentación según la taxonomía (§2).
- **Errores de la saga** llevan el paso donde ocurrieron (`step`) y si son **reintentables** (`retryable: true/false`), para que el modal sepa qué ofrecer.
- **Idempotencia:** cada certificación lleva `certificate_id`; el `CertificateRecord` on-chain y el estado del saga off-chain impiden dobles efectos aunque el reintento se dispare varias veces.
- **Integraciones externas** se envuelven con timeout + reintento con backoff; al agotar, marcan el paso del saga como fallido reintentable y notifican.
- **Observabilidad:** todo error de clase Sistema/Integración se registra con `incidentId` correlacionable; el usuario recibe ese id para soporte, no el detalle.

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
