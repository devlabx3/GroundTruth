# GroundTruth — Casos de Uso y Flujos por Rol (v1)

> Base para el diseño de navegación y gestión de errores. Cubre los 4 roles: **Visitante** (público + SEO + verificador de certificados), **Agricultor** (DApp lite), **Operador** (unidad de negocio) y **Admin GroundTruth** (máximo control). Cada rol incluye su inventario de casos de uso y su diagrama Mermaid exhaustivo con ramas de error.

---

## 0. Modelo de roles y permisos (RBAC dinámico por unidad)

### 0.1 Jerarquía

```
GroundTruth (ADMIN — máxima autoridad de la plataforma)
 └── Unidad de negocio (cooperativa, asociación, gremio, agrupación de tierras…)
      ├── Miembros operadores: N usuarios, cada uno con un SUB-ROL creado por la propia unidad
      │    └── Sub-rol = conjunto de privilegios tomados del catálogo de la plataforma
      └── Agricultores: N usuarios FARMER (dueños de la tierra), vinculados a sus fincas → DApp lite
```

**Roles de sistema (fijos, definidos por la plataforma):** `ADMIN` · `OPERATOR` (membresía en una unidad, con sub-rol) · `FARMER` · Visitante (sin sesión).
**Sub-roles (dinámicos):** los crea cada unidad a demanda, con el nombre que quiera, combinando privilegios del catálogo. No existen sub-roles predefinidos por la plataforma, salvo el que se siembra al crear la unidad (ver guardarraíles).
**Membresía:** la relación es `usuario × unidad × sub-rol`. Un mismo usuario puede tener membresías en varias unidades y puede además portar el rol `FARMER` (caso agricultor-exportador: es su propia unidad y trabaja su tierra; en UI, selector de contexto dashboard ↔ DApp lite).

### 0.2 Catálogo de privilegios (definido y versionado por la plataforma)

Los privilegios son verbos del dominio; las unidades no los inventan, los combinan. Catálogo del MVP:

| Privilegio | Alcance | Sensible |
| --- | --- | :-: |
| `unidad.configurar` | Datos de la unidad, preferencias | — |
| `equipo.gestionar` | Crear/editar sub-roles, invitar/desactivar miembros, asignar sub-roles | ⚠ |
| `agricultores.gestionar` | Crear cuentas FARMER, vincular/desvincular agricultor↔finca | ⚠ |
| `topologia.gestionar` | CRUD fincas, parcelas, asignación de sensores | — |
| `telemetria.ver` | Series, estados verde/rojo, alertas de la unidad | — |
| `tesoreria.ver` | Saldo, dirección de la Treasury, historial de movimientos | — |
| `embarques.preparar` | Crear embarques, seleccionar parcelas, ver preview de costos (sin ejecutar) | — |
| `certificados.emitir` | Confirmar la generación del certificado — **debita la tesorería** | ⚠⚠ |
| `certificados.revocar` | Revocación manual de certificados de la unidad | ⚠⚠ |
| `certificados.ver` | Lista/detalle de certificados y manifiestos | — |

Los privilegios marcados ⚠⚠ tienen efecto económico u on-chain irreversible; asignarlos a un sub-rol exige confirmación explícita y queda auditado. El catálogo crece cuando la plataforma lanza funcionalidades nuevas (los sub-roles existentes no las reciben automáticamente: cada unidad decide a quién asignárselas).

### 0.3 Guardarraíles (impuestos por la plataforma, no configurables)

1. **Siembra inicial:** al crear una unidad, el Admin crea su primer miembro con un sub-rol autogenerado "Administración de la unidad" que contiene todos los privilegios. Es un sub-rol dinámico más: la unidad puede renombrarlo o crear otros.
2. **Nunca sin timón:** siempre debe existir al menos un miembro activo con `equipo.gestionar`. El sistema bloquea desactivar o degradar al último.
3. **`FARMER` no es un sub-rol:** es rol de sistema con superficie propia (DApp lite). Declarar nueva siembra es exclusivo del agricultor y no es asignable a operadores.
4. **Toda mutación de sub-roles/membresías queda en el registro de auditoría** (quién, cuándo, qué cambió).
5. **Los cambios de privilegios aplican en la siguiente sesión o refresh de token**, nunca de forma retroactiva sobre acciones ya ejecutadas.

### 0.4 Matriz de permisos (por rol de sistema; en Operador, según privilegios del sub-rol)

| Capacidad | Visitante | Agricultor | Operador (privilegio requerido) | Admin |
| --- | :-: | :-: | :-- | :-: |
| Ver landing / SEO / idioma | ✔ | ✔ | ✔ | ✔ |
| **Verificar certificado (sin login)** | ✔ | ✔ | ✔ | ✔ |
| Ver alertas IoT / telemetría | — | ✔ (sus parcelas) | `telemetria.ver` | ✔ (global) |
| Declarar nueva siembra | — | ✔ (sus parcelas) | — (guardarraíl 3) | — |
| Gestionar equipo y sub-roles de la unidad | — | — | `equipo.gestionar` | ✔ (soporte) |
| Crear agricultores / vincular fincas | — | — | `agricultores.gestionar` | ✔ (global) |
| CRUD fincas / parcelas / sensores | — | — | `topologia.gestionar` | ✔ (global) |
| Ver tesorería / historial | — | — | `tesoreria.ver` | ✔ (todas, solo lectura) |
| Preparar embarque (sin ejecutar) | — | — | `embarques.preparar` | — |
| **Generar certificado (debita USDC)** | — | — | `certificados.emitir` | — |
| Revocación manual | — | — | `certificados.revocar` (su unidad) | ✔ (global) |
| Parámetros del sistema y catálogo de privilegios | — | — | — | ✔ |
| Alta de unidades / Operador inicial / simulador / saga / integraciones | — | — | — | ✔ |

Implementación: tabla de membresía `usuario × unidad × sub-rol` + tabla `sub-rol × privilegios`; las políticas RLS de Supabase y los guards de NestJS resuelven contra los privilegios efectivos (claims en el JWT, refrescados al cambiar el sub-rol).

---

## 1. VISITANTE (público, no autenticado)

### 1.1 Casos de uso

- **V1 — Landing multi-idioma (SEO):** propuesta de valor, cómo funciona, precios/contacto. Rutas `/es/…` por defecto, `hreflang`, sitemap por idioma, metadatos localizados. Selector de idioma persistente (cookie/localStorage).
- **V2 — Verificador público de certificados (sin login):** para entidades regulatorias, importadores y auditores.
  - Entradas: (a) **escaneo de QR** impreso en el PDF del certificado y embebido como URL en el GeoJSON; (b) **número de certificado** `GT-AAAA-NNNNN`; (c) **asset ID del cNFT**.
  - Salida pública: estado (`VIGENTE / SUSTITUIDO / EXPIRADO / REVOCADO`), cultivo, país/región, fechas del ciclo, hashes anclados (PDF, imagen satelital), URI del GeoJSON en Arweave, enlace al explorer de Solana.
  - **Verificación de documento:** el visitante puede subir el PDF que recibió; el sistema calcula su SHA-256 en el navegador y lo compara con el hash on-chain → "documento íntegro" o "documento NO coincide".
  - **Privacidad:** no expone nombre del agricultor, contacto, telemetría cruda ni polígono de precisión total (el GeoJSON completo viaja por el canal oficial TRACES NT). Rate-limiting por IP contra scraping.
- **V3 — Solicitar demo / contacto comercial:** formulario breve → lead.
- **V4 — Iniciar sesión:** puerta a los roles autenticados.

### 1.2 Diagrama

```mermaid
flowchart TD
    A(["Visitante llega al sitio"]) --> B{"Origen"}
    B -->|Busqueda organica SEO| C["Landing /:locale con hreflang"]
    B -->|QR impreso en PDF o GeoJSON| V0["/verify/:certId precargado"]
    B -->|URL directa| C

    C --> LANG["Selector de idioma - persiste preferencia"]
    LANG --> C
    C --> C1["Como funciona / propuesta de valor"]
    C --> C2["Solicitar demo"]
    C2 --> C2a["Formulario contacto"]
    C2a -->|Envio OK| C2b["Confirmacion - lead registrado"]
    C2a -->|Campos invalidos| C2err["Errores de validacion inline"]
    C2err --> C2a
    C --> C3["Iniciar sesion"] --> AUTH["Flujo de autenticacion por rol"]

    C --> V1["Verificador publico de certificados"]
    V0 --> V2
    V1 --> VIN{"Metodo de entrada"}
    VIN -->|Numero GT-AAAA-NNNNN| V2["Buscar certificado"]
    VIN -->|Asset ID del cNFT| V2
    VIN -->|Subir PDF recibido| V3["Calcular SHA-256 del PDF en el navegador"]

    V2 --> VF{"Encontrado?"}
    VF -->|No| VNF["No existe un certificado con ese identificador"]
    VNF --> V1
    VF -->|Rate limit excedido| VRL["Demasiadas consultas - reintentar mas tarde"]
    VF -->|Si| V4["Ficha publica del certificado"]

    V4 --> V4a["Estado: VIGENTE / SUSTITUIDO / EXPIRADO / REVOCADO"]
    V4 --> V4b["Cultivo, pais/region, fechas del ciclo"]
    V4 --> V4c["Hashes anclados: PDF e imagen satelital"]
    V4 --> V4d["Enlace a explorer de Solana - verificacion independiente"]
    V4 --> V4e["URI del GeoJSON en Arweave"]

    V3 --> V5{"Hash del PDF coincide con el on-chain?"}
    V5 -->|Si| V5ok["Documento integro - sello verde"]
    V5 -->|No| V5bad["Documento NO coincide - posible adulteracion - sello lacre"]
    V5 -->|Certificado no hallado| VNF

    V4a -->|REVOCADO| V6["Aviso: este certificado fue revocado en fecha X - no valido para despacho"]
```

---

## 2. AGRICULTOR (DApp lite)

### 2.1 Casos de uso

- **F1 — Autenticación:** login Supabase Auth con rol `FARMER`. RLS lo limita a sus parcelas. Bloqueado del dashboard de gestión.
- **F2 — Ver alertas IoT (Realtime):** alertas de sus cultivos (umbral verde/rojo desde telemetría), en vivo vía Supabase Realtime. Estado vacío si no hay alertas.
- **F3 — Ver estado de sus parcelas (solo lectura):** lista de sus parcelas con estado, cultivo, ciclo activo y núcleo de verificación.
- **F4 — Declarar nueva siembra (única acción de escritura):** por parcela; con confirmación explícita porque cierra el ciclo anterior (pasa a `SUSTITUIDO`) y el próximo despacho re-certifica y cobra.
- **F5 — Ver historial de ciclos y certificados de sus parcelas (solo lectura).**
- **Futuro (fuera de MVP, visible como extensión):** entrega de alertas por WhatsApp; micropago por certificado (Fase 2).

### 2.2 Diagrama

```mermaid
flowchart TD
    A(["Agricultor abre la DApp lite"]) --> L{"Sesion valida?"}
    L -->|No| L1["Login Supabase Auth"]
    L1 -->|Credenciales invalidas| L1e["Error: verifica tus datos"]
    L1e --> L1
    L1 -->|Rol distinto de FARMER| L1r["Acceso denegado - redirige a login de dashboard"]
    L1 -->|OK rol FARMER| H
    L -->|Si| H["Inicio DApp: mis parcelas + alertas"]

    H --> AL["Alertas IoT en vivo - Supabase Realtime"]
    AL -->|Sin alertas| AL0["Estado vacio: tus cultivos estan en orden"]
    AL -->|Alerta activa| AL1["Detalle de alerta: variable, valor, umbral, parcela"]
    AL1 --> AL2["Estado de la parcela pasa a rojo - certificado en riesgo o REVOCADO"]
    AL -->|Conexion Realtime caida| ALe["Aviso: sin conexion en vivo - reintentando"]

    H --> P["Mis parcelas - solo lectura"]
    P --> P1["Detalle: cultivo, area, ciclo activo, nucleo de verificacion"]
    P1 --> HIS["Historial de ciclos y certificados"]
    HIS --> HIS1["Ciclo actual ACTIVO / anteriores SUSTITUIDOS"]

    P1 --> NS["Declarar nueva siembra"]
    NS --> NSC{"Confirmacion explicita: esto cierra el ciclo actual y el proximo despacho re-certifica y cobra"}
    NSC -->|Cancelar| P1
    NSC -->|Confirmar| NSX["POST /farmer/parcelas/:id/nueva-siembra"]
    NSX -->|OK| NSok["Ciclo anterior SUSTITUIDO - nuevo ciclo abierto - aviso al operador"]
    NSok --> P1
    NSX -->|Ya existe una siembra declarada hoy| NSdup["Aviso: ya declaraste una siembra reciente - contacta a tu operador si fue un error"]
    NSX -->|Parcela con certificacion en curso| NSlock["No disponible: hay una certificacion en proceso para esta parcela"]
    NSX -->|Error de red| NSerr["No se pudo registrar - reintentar"]
    NSerr --> NS

    H --> CFG["Preferencias: idioma"]
    H -.->|Futuro| W["Alertas tambien por WhatsApp"]
    P1 -.->|Fase 2| MP["Micropago por certificado emitido"]
```

---
## 3. OPERADOR (unidad de negocio / cooperativa)

### 3.1 Casos de uso

- **O1 — Autenticación:** rol `OPERATOR` con membresía `usuario × unidad × sub-rol`; RLS por unidad. La navegación y las acciones visibles se derivan de los **privilegios efectivos** del sub-rol (un miembro sin `tesoreria.ver` no ve el módulo de tesorería). Usuario con membresías en varias unidades o con rol FARMER adicional → selector de contexto al entrar.
- **O2 — Dashboard:** mapa verde/rojo de parcelas (Leaflet), métricas (parcelas activas, certificados vigentes, alertas), saldo de tesorería visible (si tiene `tesoreria.ver`).
- **O3 — Tesorería** (`tesoreria.ver`): ver saldo USDC, copiar dirección de su Treasury PDA, historial de depósitos (detectados por Helius) y de débitos (certificaciones/manifiestos). Depositar = instrucciones + dirección (desde Phantom/Solflare/MetaMask/exchange por red Solana).
- **O4 — Topología** (`topologia.gestionar`): CRUD de fincas y parcelas (polígono en Leaflet, cultivo único, área calculada). **Gate de sensores:** el sistema calcula cobertura requerida (1/5.000 m², configurable) y bloquea el guardado/certificación si no cumple; asignación de nodos (simulados en MVP).
- **O5 — Agricultores** (`agricultores.gestionar`): crear cuentas `FARMER`, vincular/desvincular agricultor↔finca. (Ya no depende del Admin: cada unidad gestiona a su gente.)
- **O6 — Telemetría** (`telemetria.ver`): series por parcela (pH, EC, humedad, temperatura ×2), estado verde/rojo en vivo.
- **O7 — Embarques (núcleo Pay-per-Proof):** preparar (`embarques.preparar`): crear embarque → seleccionar parcelas (validaciones: mismo cultivo, estado verde, cobertura) → clasificación `ACTIVOS` reutilizables vs emisiones nuevas → **preview de costos**. **Ejecutar (`certificados.emitir` — privilegio sensible):** confirmar → saga (satélite → Storage → Arweave → TX Solana) con progreso → manifiesto + GeoJSON agregado para TRACES NT. Quien prepara sin poder emitir deja el embarque **listo para aprobación** de alguien con el privilegio (separación preparador/aprobador).
- **O8 — Certificados** (`certificados.ver`): lista y detalle por parcela×ciclo (estado, hashes, URI Arweave, asset ID, enlaces a verificador público y explorer). **Revocación manual** (`certificados.revocar`), con confirmación y motivo.
- **O9 — Equipo y sub-roles** (`equipo.gestionar`): crear sub-roles a demanda (nombre libre + selección de privilegios del catálogo), invitar miembros, asignar/cambiar sub-rol, desactivar miembros. Guardarraíles: privilegios ⚠⚠ exigen confirmación explícita al asignarse; el sistema impide quedarse sin ningún miembro con `equipo.gestionar`; toda mutación queda auditada.
- **O10 — Perfil/config** (`unidad.configurar`): idioma, datos de la unidad.

### 3.2 Diagrama

```mermaid
flowchart TD
    A(["Operador inicia sesion"]) --> L{"Auth OK y rol OPERATOR?"}
    L -->|No| Le["Error credenciales / acceso denegado"]
    L -->|Si| CTX{"Varias membresias o rol FARMER adicional?"}
    CTX -->|Si| CTXs["Selector de contexto: unidad / DApp lite"]
    CTXs --> PRIV
    CTX -->|No| PRIV["Se cargan privilegios efectivos del sub-rol - definen navegacion visible"]
    PRIV --> D["Dashboard: mapa verde-rojo + metricas + saldo si tesoreria.ver"]

    D -->|tesoreria.ver| T["Tesoreria"]
    T --> T1["Saldo USDC actual"]
    T --> T2["Copiar direccion Treasury PDA"]
    T2 --> T3["Deposito desde wallet red Solana: Phantom / Solflare / MetaMask / exchange"]
    T3 --> T4["Helius detecta deposito por cuenta destino"]
    T4 -->|Acreditado| T1
    T4 -->|Deposito en red equivocada| T4e["Aviso: solo USDC-SPL por red Solana"]
    T --> T5["Historial: depositos y debitos por certificacion/manifiesto"]

    D -->|topologia.gestionar| TOP["Topologia: fincas y parcelas"]
    TOP --> P1["Crear/editar parcela: dibujar poligono Leaflet + cultivo"]
    P1 --> P2{"Poligono valido?"}
    P2 -->|Auto-interseccion o area cero| P2e["Error: corrige el poligono"]
    P2e --> P1
    P2 -->|Si| P3{"Cobertura de sensores cumple regla configurable 1 por 5000 m2?"}
    P3 -->|No| P3e["Bloqueo: requiere N sensores adicionales - asignar nodos"]
    P3e --> P4["Asignar nodos simulados"]
    P4 --> P3
    P3 -->|Si| P5["Parcela registrada - PDA on-chain via backend"]

    D -->|agricultores.gestionar| AGR["Agricultores de la unidad"]
    AGR --> AGR1["Crear cuenta FARMER"]
    AGR1 -->|Email ya registrado| AGR1e["Error: usuario existente - vincular en su lugar"]
    AGR --> AGR2["Vincular / desvincular agricultor a finca"]
    AGR2 -->|Finca ya vinculada a otro| AGR2e["Confirmar reasignacion - queda auditada"]

    D -->|telemetria.ver| TEL["Telemetria por parcela: pH, EC, humedad, temp x2"]
    TEL -->|Umbral excedido| TELr["Parcela en rojo - alerta emitida - certificado REVOCADO si estaba ACTIVO"]

    D -->|embarques.preparar| E["Embarques"]
    E --> E1["Nuevo embarque: seleccionar parcelas"]
    E1 --> E2{"Validaciones"}
    E2 -->|Cultivos mezclados| E2a["Error: todas las parcelas deben compartir cultivo"]
    E2a --> E1
    E2 -->|Alguna parcela en rojo| E2b["Error: parcela con anomalia - no certificable"]
    E2b --> E1
    E2 -->|Cobertura de sensores incumplida| E2c["Error: parcela sin cobertura minima"]
    E2c --> E1
    E2 -->|OK| E3["Sistema clasifica: certificados ACTIVOS reutilizables vs emisiones nuevas"]
    E3 --> E4["Preview de costo: N nuevas x tarifa_certificacion + tarifa_manifiesto"]
    E4 --> E4p{"Tiene privilegio certificados.emitir?"}
    E4p -->|No| E4q["Embarque queda LISTO PARA APROBACION - notifica a miembros con el privilegio"]
    E4q --> E4r["Un aprobador revisa el embarque preparado"]
    E4r --> E5
    E4p -->|Si| E5{"Confirmar generacion? Accion con debito de tesoreria"}
    E5 -->|Cancelar| E1
    E5 -->|Confirmar| S0["Saga CERT_PENDING"]

    S0 --> S1["Evidencia satelital por parcela nueva: descarga + copia a Supabase Storage + hashes"]
    S1 -->|Sentinel Hub caido| S1e["Reintento programado - embarque queda PENDIENTE"]
    S1 --> S2["GeoJSON por parcela con hashes embebidos + GeoJSON agregado a Arweave"]
    S2 -->|Fallo de subida Arweave| S2e["Reintento idempotente - sin doble costo"]
    S2 --> S3["TX atomica Solana: certify N cNFTs + debito"]
    S3 -->|Fondos insuficientes| S3a["Error: fondos insuficientes en Treasury - ir a Tesoreria"]
    S3a --> T
    S3 -->|CertificateRecord duplicado| S3b["Idempotencia: se reutiliza el cNFT ya emitido"]
    S3 -->|TX fallida por red| S3c["Reintento idempotente - no hay cobro parcial"]
    S3 --> S4["TX emit_manifest: micro-tarifa + URI del manifiesto"]
    S4 --> S5["Exito: manifiesto referencia N cNFTs"]
    S5 --> S6["Descargar GeoJSON agregado para TRACES NT"]
    S5 --> S7["QR y numero de certificado impresos en PDF - apuntan al verificador publico"]

    E --> EH["Historial de embarques y manifiestos"]

    D -->|certificados.ver| C["Certificados"]
    C --> C1["Lista por parcela x ciclo con estado"]
    C1 --> C2["Detalle: hashes, URI Arweave, asset ID, enlaces a verificador y explorer"]
    C2 -->|certificados.revocar| C3["Revocacion manual - solo su unidad"]
    C3 --> C4{"Confirmar con motivo? Irreversible: la parcela no entra a embarques hasta re-certificar"}
    C4 -->|Cancelar| C2
    C4 -->|Confirmar| C5["Certificado REVOCADO - registro de auditoria"]

    D -->|equipo.gestionar| EQ["Equipo y sub-roles de la unidad"]
    EQ --> EQ1["Crear sub-rol: nombre libre + privilegios del catalogo"]
    EQ1 --> EQ1a{"Incluye privilegios sensibles emitir/revocar?"}
    EQ1a -->|Si| EQ1b["Confirmacion explicita: este sub-rol podra debitar la tesoreria - auditado"]
    EQ1b --> EQ1c["Sub-rol creado"]
    EQ1a -->|No| EQ1c
    EQ --> EQ2["Invitar miembro y asignar sub-rol"]
    EQ2 -->|Email ya es miembro| EQ2e["Error: ya pertenece a la unidad - cambiar su sub-rol"]
    EQ --> EQ3["Cambiar sub-rol de un miembro"]
    EQ3 --> EQ3a["Aplica en la siguiente sesion o refresh de token"]
    EQ --> EQ4["Desactivar miembro"]
    EQ4 --> EQ5{"Es el ultimo con equipo.gestionar?"}
    EQ5 -->|Si| EQ5e["Bloqueado: la unidad no puede quedar sin administracion"]
    EQ5 -->|No| EQ6["Miembro desactivado - auditado"]
    EQ --> EQ7["Editar o eliminar sub-rol"]
    EQ7 -->|Sub-rol en uso por miembros| EQ7e["Reasignar miembros antes de eliminar"]

    D -->|unidad.configurar| CFG["Perfil: idioma, datos de la unidad"]
```

---

## 4. ADMIN GROUNDTRUTH (máximo control)

### 4.1 Casos de uso

- **A1 — Gestión de unidades de negocio:** alta de unidad → dispara `init_operator_treasury` (crea Treasury PDA + ATA on-chain) **y siembra el primer miembro** con el sub-rol autogenerado "Administración de la unidad" (todos los privilegios). Baja/suspensión; vista de todas las tesorerías (solo lectura de saldos y movimientos — el Admin nunca gasta fondos de operadores).
- **A2 — Catálogo de privilegios (plataforma):** el Admin mantiene el catálogo versionado de privilegios asignables a sub-roles (los verbos del dominio). Al lanzar una funcionalidad nueva se agrega su privilegio al catálogo; las unidades deciden a qué sub-roles asignarlo. El Admin **no crea sub-roles de las unidades** (eso es de cada unidad), pero puede intervenir como soporte con auditoría (ej. unidad bloqueada sin administrador por caso extremo).
- **A3 — Soporte de usuarios y membresías:** crear/desactivar usuarios de cualquier rol como soporte; resolver vínculos agricultor↔finca en disputa; toda intervención queda auditada. La operación normal (crear agricultores, gestionar equipo) vive en cada unidad.
- **A4 — Parámetros del sistema (todos configurables y versionados):** `tarifa_certificacion`, `tarifa_manifiesto`, umbrales EUDR por variable y por cultivo, `vigencia_max` por cultivo, densidad de sensores (m² por sensor). Cambios con registro de auditoría (quién, cuándo, valor anterior).
- **A5 — Simulador IoT:** iniciar/detener nodos, asignar perfiles ("suelo sano" / "suelo degradado"), inyectar anomalía puntual (para demostrar alerta + revocación en vivo).
- **A6 — Supervisión global:** todas las parcelas/certificados/embarques de todos los operadores; búsqueda transversal.
- **A7 — Auditoría del saga:** cola de certificaciones (`CERT_PENDING`, `FAILED`), reintentos manuales, inspección de errores por paso (satélite/Arweave/Solana).
- **A8 — Revocación global:** revocar cualquier certificado con motivo (casos de fraude o soporte). Rol de **mediador/validador ante entidades regulatorias**: el Admin es el interlocutor de GroundTruth ante auditores; el verificador público reduce esa carga a los casos que requieren intervención humana.
- **A9 — Salud de integraciones:** estado de Sentinel Hub (OAuth vigente), webhooks Helius (últimos eventos), balance SOL para Irys/Arweave (fondeo del storage permanente), RPC Solana, Supabase. Alertas si algo cae.
- **A10 — Operación del firmante (documentado, fuera de UI):** rotación de keypair en KMS/HSM; runbook, no pantalla.

### 4.2 Diagrama

```mermaid
flowchart TD
    A(["Admin inicia sesion"]) --> L{"Auth OK y rol ADMIN?"}
    L -->|No| Le["Acceso denegado"]
    L -->|Si| H["Panel global"]

    H --> OP["Unidades de negocio"]
    OP --> OP1["Alta de unidad"]
    OP1 --> OP2["init_operator_treasury: crea Treasury PDA + ATA"]
    OP2 -->|TX fallida| OP2e["Reintento - unidad queda PENDIENTE_ONCHAIN"]
    OP2 -->|OK| OP2b["Siembra primer miembro con sub-rol Administracion de la unidad - todos los privilegios"]
    OP2b --> OP3["Unidad activa: gestiona su propio equipo y sub-roles"]
    OP --> OP4["Suspender / reactivar unidad"]
    OP4 -->|Con embarque en curso| OP4e["Bloqueado: hay una certificacion en proceso"]
    OP --> OP5["Ver tesorerias - solo lectura de saldos y movimientos"]

    H --> CAT["Catalogo de privilegios - plataforma"]
    CAT --> CAT1["Agregar privilegio al lanzar funcionalidad nueva"]
    CAT1 --> CAT2["Las unidades deciden a que sub-roles asignarlo - nunca es automatico"]
    CAT --> CAT3["Deprecar privilegio"]
    CAT3 -->|En uso por sub-roles| CAT3e["Aviso de impacto: listar unidades afectadas antes de deprecar"]

    H --> U["Soporte de usuarios y membresias - con auditoria"]
    U --> U1["Crear/desactivar usuario de cualquier rol - solo soporte"]
    U1 -->|Email ya registrado| U1e["Error: usuario existente"]
    U --> U2["Resolver vinculo agricultor-finca en disputa"]
    U --> U3["Rescate: unidad sin ningun miembro con equipo.gestionar"]
    U3 --> U3a["Reasignar sub-rol de administracion a un miembro - intervencion auditada"]

    H --> PAR["Parametros del sistema - versionados con auditoria"]
    PAR --> PAR1["Tarifas: certificacion y manifiesto"]
    PAR --> PAR2["Umbrales EUDR por variable y cultivo"]
    PAR --> PAR3["vigencia_max por cultivo"]
    PAR --> PAR4["Densidad de sensores m2 por sensor"]
    PAR1 --> PARv{"Validacion de rangos"}
    PAR2 --> PARv
    PAR3 --> PARv
    PAR4 --> PARv
    PARv -->|Fuera de rango| PARe["Error: valor invalido"]
    PARv -->|OK| PARok["Guardado + registro: quien, cuando, valor anterior"]
    PARok -.-> NOTE1["Los cambios aplican a certificaciones futuras - nunca retroactivos"]

    H --> SIM["Simulador IoT"]
    SIM --> SIM1["Iniciar / detener nodos por parcela"]
    SIM --> SIM2["Perfil: suelo sano / suelo degradado"]
    SIM --> SIM3["Inyectar anomalia puntual"]
    SIM3 --> SIM4["Se dispara alerta al agricultor + parcela en rojo + REVOKED si tenia certificado ACTIVO"]

    H --> SUP["Supervision global: parcelas, certificados, embarques de todos los operadores"]
    SUP --> SUP1["Busqueda transversal por id, cultivo, estado, operador"]

    H --> SAGA["Auditoria del saga de certificacion"]
    SAGA --> SG1["Cola: CERT_PENDING / FAILED por paso"]
    SG1 --> SG2{"Paso fallido"}
    SG2 -->|Sentinel Hub| SG2a["Ver error + reintentar descarga"]
    SG2 -->|Arweave/Irys| SG2b["Ver error + reintentar subida - idempotente"]
    SG2 -->|Solana| SG2c["Ver error + reintentar TX - CertificateRecord evita doble mint"]
    SG2c -->|Fondos insuficientes del operador| SG2d["Notificar al operador - no es accion del Admin"]

    H --> REV["Revocacion global"]
    REV --> REV1{"Confirmar con motivo - irreversible"}
    REV1 -->|Confirmar| REV2["Certificado REVOCADO en cualquier operador + auditoria"]

    H --> INT["Salud de integraciones"]
    INT --> I1["Sentinel Hub: OAuth vigente / caido"]
    INT --> I2["Helius: ultimos webhooks recibidos"]
    INT --> I3["Irys/Arweave: balance SOL para storage - alerta si bajo"]
    I3 -->|Balance bajo| I3e["Accion: fondear cuenta Irys o las certificaciones fallaran"]
    INT --> I4["RPC Solana y Supabase: latencia y estado"]
```

---

## 5. Notas transversales para navegación y errores (siguiente fase)

1. **Autenticación y expiración de sesión:** cualquier 401 en cualquier rol → redirige a login conservando la ruta de retorno. El rol determina el shell de navegación (dashboard vs DApp lite); un `FARMER` que intenta una ruta de dashboard recibe 403 con redirección, nunca un shell vacío.
2. **Errores del saga son asincrónicos:** el operador no espera bloqueado; el embarque queda `PENDIENTE` con progreso visible (núcleo de suelo como barra) y notificación al resolverse. Los reintentos son idempotentes: la UI nunca ofrece "reintentar" de forma que pueda duplicar cobro o mint.
3. **Toda acción con efecto económico u on-chain exige confirmación explícita con consecuencias en texto claro:** declarar siembra (agricultor), generar certificado (operador), revocar (operador/admin), cambiar tarifas (admin).
4. **El verificador público es la única superficie sin auth** y debe funcionar sin JavaScript pesado (SEO + accesibilidad para entidades), con rate-limiting.
5. **Estados vacíos y de carga definidos por pantalla** (sin alertas, sin parcelas, sin embarques): invitación a la acción, no disculpa.
6. **i18n aplica a todos los diagramas:** cada etiqueta de estos flujos corresponde a una clave de diccionario, nunca a texto quemado.
