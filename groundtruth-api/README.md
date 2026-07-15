# groundtruth-api — orquestador NestJS

Backend del MVP (Arquitectura §3): REST de comandos y mutaciones. El tiempo real
NO vive aquí (Supabase Realtime único — §10); este servicio escribe en Postgres y
los clientes se enteran por Realtime.

## Decisiones heredadas de los documentos

- **Supabase Auth manda:** no hay JWT propio. `AuthGuard` valida el token de Supabase
  contra su JWKS. `GET /me` devuelve el perfil con **roles derivados** (la forma exacta
  que consume `groundtruth-web/src/stores/session.js`).
- **RLS aísla filas; este backend autoriza acciones** (Modelo-de-Datos §7): conexión
  con rol de servicio (omite RLS) + `PrivilegesGuard`, que evalúa los privilegios del
  sub-rol en cada request (`@NeedsPrivilege(...)` + header `x-operador-id`).
- **Errores** (Gestion-de-Errores §6): filtro global → `{ code, messageKey, retryable, incidentId? }`.
  El frontend antepone `errors:` al `messageKey` — al integrar, agregar a `errors.json`
  (7 idiomas) las claves nuevas: `insufficient_funds`, `sensor_coverage`, `crop_mismatch`,
  `cert_exists`, `last_team_admin`.
- **Sin ORM:** el esquema vive en `../supabase/migrations` (fuente de verdad aplicada);
  aquí SQL explícito sobre `pg`.

## Arranque

```bash
pnpm install
cp .env.example .env   # SUPABASE_URL + DATABASE_URL (connection string con contraseña)
pnpm typecheck
pnpm dev               # http://localhost:3000 — el frontend ya apunta aquí
```

## Estado

| Módulo | Estado |
| --- | --- |
| `health` | ✔ `GET /health` (público, hace ping a la BD) |
| `me` | ✔ `GET /me` — perfil con membresías+privilegios+fincas |
| `topologia` | ✔ list / detail / `GET /fincas` / **`POST /parcelas`** — el servidor calcula el área con PostGIS e impone el gate de cobertura de sensores |
| `tesoreria` | ✔ `GET /tesoreria`, `GET /tesoreria/saldo` (micro-USDC → USDC) |
| `embarques` | ✔ list / detail / `POST` crear (valida cultivo único) / `POST :id/certificar` — **saga real on-chain** (ver abajo) |
| `solana` | ✔ puente con el programa Anchor: PDAs, tesorería, `certify` + `emit_manifest` en UNA transacción |
| `evidencia` | ✔ imagen (Sentinel) + PDF → Storage; GeoJSON con sus hashes → Arweave |
| `webhooks/helius` | ✔ avisa de depósitos USDC; la ingesta real la hace el reconciliador |
| `public` | ✔ **verificador público** (V2): `GET /public/certificates?by=number\|asset\|hash`. Sin auth, rate-limited por IP, solo lee la vista `certificados_publicos` |
| `certificados` | ✔ list / detail / `POST :id/revocar` (transacción + auditoría; solo un certificado vigente) |
| `farmer` | ✔ alertas / mis parcelas / detalle / `POST :id/nueva-siembra` — **autoriza por propiedad de finca, no por privilegio** (sin `x-operador-id`); nueva siembra cierra el ciclo activo y abre uno nuevo; bloquea duplicado <24 h **y certificación en curso** (si no, se cobraría un cNFT para un ciclo que acaba de quedar obsoleto) |
| `equipo` | ✔ overview / crear+eliminar sub-rol / cambiar sub-rol de miembro — reglas duras: `SUBROLE_IN_USE`, `SUBROLE_EXISTS`, y el trigger DB `LAST_TEAM_ADMIN` |
| `unidad` | ✔ GET / PATCH perfil de la unidad (auditado) |
| `agricultores` | ✔ list / `POST` crear (usuario + finca, auditado; login del agricultor pendiente del flujo de invitación) |
| `admin` | ✔ superficie de plataforma (`AdminGuard`, `usuarios.es_admin`): overview, unidades (alta + suspender), usuarios, privilegios, parámetros, saga, certificados, integraciones, simulador IoT |

**Operador (13/13), Agricultor y Admin (12/12): superficies completas y reales**, contra
Postgres y contra la cadena.

**Pendiente:** la imagen satelital (faltan credenciales de Sentinel; el pipeline está
cableado y se enciende solo) y el flujo de invitación de Supabase Auth — los usuarios que
crea el Admin existen en el dominio pero todavía no pueden iniciar sesión.

### Notas del Admin

- **No usa `x-operador-id`.** El admin no pertenece a una unidad, las cruza todas; por eso vive
  bajo `/admin` con guard propio en vez de reutilizar los endpoints del operador.
- **Reusa, no duplica:** revocar y reintentar el saga delegan en `CertificadosService` y
  `EmbarquesService` — una sola ruta de emisión/revocación, con su transacción e idempotencia.
- **Suspender una unidad muerde:** `embarques.certificar` exige `operadores.estado = 'ACTIVO'`
  (`UNIT_NOT_ACTIVE`), así que no es una etiqueta cosmética.
- **Parámetros no decorativos:** tarifas y vigencia (por cultivo) las lee el certify al cobrar.
- **Deprecar un privilegio** = deja de poder ASIGNARSE (`equipo.crearSubrol` lo rechaza); quien
  ya lo tiene lo conserva (§A2). `PrivilegesGuard` y `GET /me` lo siguen aceptando, en ese orden.
- **Alta de unidad:** nace `PENDIENTE_ONCHAIN` y **sin** Treasury PDA. Esa cuenta es on-chain
  (`init_operator_treasury`) y se crea aparte; hasta entonces la unidad puede configurarse
  (equipo, fincas), pero **no certificar**.
- **Integraciones:** solo se sondean Supabase y, si se configura `SOLANA_RPC_URL`, el RPC. Sentinel,
  Helius e Irys se reportan `no_configurado` en vez de fingir un "ok".

## La certificación es on-chain

`POST /embarques/:id/certificar` emite de verdad contra el programa Anchor
(`../groundtruth-program`): cobra USDC de la Treasury PDA y mintea un **cNFT por parcela**
vía Bubblegum — todo en **una sola transacción** de Solana.

Es una **saga de tres fases**, porque la BD y la cadena no pueden compartir transacción:

1. **Preparar** (transacción BD): valida, reserva el número público (es el nombre del cNFT,
   hace falta antes de mintear), marca el embarque `PROCESANDO` y el saga `CERT_PENDING`.
2. **Emitir** (cadena): N × `certify` + 1 × `emit_manifest` en una TX. Si algo falla, Solana
   revierte todo: no hay cobro ni mint parcial.
3. **Reconciliar** (transacción BD): guarda los `cnft_asset_id`, la firma real y el saldo
   **leído de la cadena** — no una resta optimista. El ATA es la fuente de verdad;
   `saldo_cache` es solo un espejo, y así no puede derivar.

Si la fase 2 falla, la 3 no ocurre y **no se cobra nada**: el embarque vuelve a `BORRADOR`
y el saga queda `FAILED` reintentable (el Admin lo reintenta desde su vista). El reintento
**reconcilia en vez de duplicar**: los certificados que ya existen on-chain se detectan por
su PDA `["cert", parcela, ciclo]` y su asset ID se lee de la cadena.

**Sin las variables `SOLANA_*` el backend cae a la ruta pre-Solana** (transacción DB que
imita los efectos): el sistema sigue usable en local/demo sin cadena, y activar on-chain es
una decisión de entorno, no un cambio de código.

Para levantar el estado on-chain en un validador local:
`node scripts/bootstrap-solana.mjs <operador_id>` — crea el USDC de prueba, la `Config`, el
árbol de certificados y la tesorería de la unidad, la fondea, y apunta la fila de
`tesorerias` a las direcciones reales.

## Alta de parcela (O4)

`POST /topologia/parcelas` recibe el polígono dibujado en el mapa y los nodos declarados.

- **El área la calcula PostGIS, no el navegador.** De ella depende cuántos sensores exige la
  parcela, y esa regla **no puede vivir en el cliente**: el gate de cobertura se impone en el
  servidor (`SENSOR_COVERAGE_UNMET`), y la UI solo lo refleja para evitar un viaje inútil.
  En la práctica los números difieren — el estimador del mapa dio 9 ha donde PostGIS dice
  10,75, o sea 6 sensores en vez de 5. Por eso el error viaja con **su** `n`, no con el del
  navegador.
- **Rechaza polígonos inválidos** (`ST_IsValid`): uno que se cruza a sí mismo tiene área, pero
  no describe ninguna parcela real.
- **Los nodos nacen con la parcela.** `nodos_sensores.parcela_id` es NOT NULL: un nodo "libre"
  no existe en el modelo. Se crean SIMULADO; el hardware real se asocia después por su
  `chirpstack_dev_eui` (mismo payload, cero cambios de backend).
- **NO abre ciclo de siembra**: eso lo declara el agricultor desde su dApp. Una parcela recién
  creada existe pero **no puede certificarse** hasta que haya siembra (`NO_ACTIVE_CYCLE`).

## Depósitos a la tesorería (F3)

**La cadena es la fuente de verdad; el webhook solo avisa.** Un webhook es best-effort: se
pierde, llega dos veces, llega tarde. Si la contabilidad dependiera de él, un aviso perdido
sería dinero del operador que no aparece. Por eso:

- `POST /webhooks/helius` **no se cree el payload**: solo dispara la reconciliación. Un aviso
  falsificado, como mucho, provoca una lectura de más — nunca un depósito inventado, porque
  el dinero lo pone el ATA, no el JSON.
- `DepositosService.sincronizar()` **lee la cadena**, ingiere lo que falte y deja `saldo_cache`
  con el saldo real del ATA (no una suma de movimientos: así el espejo no puede derivar).
- Se ejecuta al abrir la tesorería, a demanda (`POST /tesoreria/sincronizar`) y cuando avisa
  Helius. Sin Helius, el sistema cuadra igual.
- Recorre la cadena **paginando hacia atrás hasta la última firma ya ingerida**: un `limit`
  fijo se comería depósitos si el backend hubiera estado caído.
- Idempotente por `movimientos_tesoreria.tx_signature` (único).

El endpoint es **público** (lo llama Helius, no una persona): la autenticación es un secreto
compartido comparado en **tiempo constante**. Sin `HELIUS_WEBHOOK_SECRET` queda **cerrado** —
un endpoint público sin autenticar es peor que no tenerlo.

> **La dirección de depósito es el ATA, no la Treasury PDA.** Ahí viven los USDC y es la cuenta
> que vigila el reconciliador; la PDA está fuera de la curva y varias wallets se niegan a
> enviarle tokens. Publicar la PDA sería invitar a que un depósito se pierda.

## La cadena de evidencia (`src/evidencia/`)

Se construye **antes** de mintear, y el orden no es casual:

1. **Imagen satelital** (Sentinel Hub) → Supabase Storage → SHA-256.
2. **PDF del certificado** (pdfkit) → Supabase Storage → SHA-256.
3. **GeoJSON de la parcela** con **esos hashes embebidos dentro** → Arweave (Irys) → `ar://…`.
4. El cNFT ancla el **URI del GeoJSON** + los dos hashes.

Al revés no cerraría: el GeoJSON permanente no podría probar nada sobre los archivos
pesados. Y los archivos pesados nunca viajan on-chain — solo sus huellas (Arquitectura §11).

**Cada pata se degrada sola y ninguna inventa nada.** Sin Sentinel no hay imagen (hash en
ceros, y **no** se crea fila en `evidencias_satelitales`, que exige imagen por diseño); sin
Storage no hay PDF; sin Irys el URI es una referencia interna. Lo que nunca ocurre es
fabricar un hash.

| Variable | Efecto si falta |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | sin PDF ni imagen en Storage |
| `SENTINEL_CLIENT_ID` / `SENTINEL_CLIENT_SECRET` | sin imagen satelital ni su hash |
| `IRYS_NETWORK` | `devnet` por defecto (**efímero, ~60 días**) |

**`IRYS_NETWORK=mainnet` publica la geolocalización de las fincas en Arweave de forma
permanente e irreversible.** Es una decisión explícita, no un descuido de configuración.

**Verificado end-to-end:** el SHA-256 recalculado sobre el PDF descargado de Storage coincide
con el hash embebido en el GeoJSON de Arweave **y** con el grabado en el `CertificateRecord`
on-chain; el URI del cNFT apunta a ese GeoJSON.

**Pendiente:** la imagen satelital — falta `SENTINEL_CLIENT_ID`/`SECRET`. El pipeline está
cableado: en cuanto existan las credenciales, se enciende sin tocar código.

Ruta de integración con el frontend: cada vista cambia su `queryFn` de
`demoQueryFn(FIXTURE)` a `api.get(...)` (los puntos están marcados `TODO backend:`).
