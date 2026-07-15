<!-- Portada. Para una variante en modo oscuro, añade docs/assets/cover-dark.png y envuelve
     este <img> en un <picture> con <source media="(prefers-color-scheme: dark)">. -->
<p align="center">
  <img src="docs/assets/cover.png" alt="GroundTruth — certificación agroclimática EUDR anclada en Solana" width="100%">
</p>

<h1 align="center">GroundTruth</h1>

<p align="center">
  <strong>Certificación agroclimática EUDR con modelo <em>Pay-per-Proof</em>.</strong><br>
  Prueba híbrida de doble capa — química (IoT) y geoespacial (satélite) — anclada en Solana.
</p>

<p align="center">
  <a href="#arquitectura">Arquitectura</a> ·
  <a href="#puesta-en-marcha">Puesta en marcha</a> ·
  <a href="#estado-real">Estado real</a> ·
  <a href="#pruebas">Pruebas</a> ·
  <a href="docs/">Documentación</a>
</p>

---

## Qué resuelve

El Reglamento de Deforestación de la UE (**EUDR**) obliga a demostrar que una materia prima
—café, cacao, aguacate— no procede de tierra deforestada. Hoy esa prueba es papel, y el papel
se falsifica.

GroundTruth convierte ese cumplimiento en **ingreso automatizado**: un operador despacha un
embarque, el sistema **cobra en USDC** de su tesorería on-chain y **acuña un certificado como
cNFT** por cada parcela, anclando la evidencia de forma **verificable por un tercero** que no
tiene por qué fiarse de nosotros.

La fuerza jurídica no vive en los archivos. Vive en los **hashes anclados on-chain** y en la
**permanencia del GeoJSON** en Arweave.

> [!NOTE]
> **La verificación es la propuesta de valor.** Un auditor o un importador entra en el
> verificador público **sin cuenta**, sube el PDF que recibió, y su hash se calcula **en su
> propio navegador**. Si coincide con el que está en la cadena, el documento es auténtico. Si
> hiciera falta pedirnos permiso para comprobar un certificado, el certificado no probaría nada.

---

## Arquitectura

Cuatro piezas en un solo repositorio, porque están acopladas: un cambio de esquema toca la
migración, el backend y la interfaz en el mismo commit.

| Pieza | Qué es | Documentación |
| :--- | :--- | :--- |
| [`groundtruth-web/`](groundtruth-web/) | Frontend (React 18 + Vite 6). 37 rutas, 7 idiomas | [README](groundtruth-web/README.md) |
| [`groundtruth-api/`](groundtruth-api/) | Backend (NestJS). Autoriza acciones y orquesta la saga | [README](groundtruth-api/README.md) |
| [`groundtruth-program/`](groundtruth-program/) | Programa Anchor (Solana). Tesorería, cobro y cNFT | [README](groundtruth-program/README.md) |
| [`supabase/`](supabase/) | PostgreSQL + PostGIS. 9 migraciones aplicadas, RLS total | [README](supabase/README.md) |

### Las cinco decisiones que explican todo lo demás

Si solo lees cinco cosas de este repositorio, que sean estas.

**1. RLS aísla FILAS; NestJS autoriza ACCIONES.**
Postgres decide *qué filas* ve cada quien (multi-tenancy). *Qué se puede hacer* con ellas lo
decide el backend evaluando los privilegios del sub-rol. Nunca se mezclan: meter reglas de
negocio en RLS las volvería invisibles e imposibles de auditar.
→ [Modelo de Datos §7](docs/producto/GroundTruth-Modelo-de-Datos.md)

**2. «Rol ≠ persona».**
No existe una columna `rol`. Los roles se **derivan**: eres *operador* si tienes una membresía
activa; *agricultor* si eres dueño de una finca. Una misma persona puede ser ambas — que es
como funciona una cooperativa de verdad.
→ [Casos de Uso §0](docs/producto/GroundTruth-Casos-de-Uso-por-Rol.md)

**3. On-chain solo viaja lo que debe.**
El **valor** (USDC), las **referencias** (URI de Arweave) y las **huellas** (SHA-256). La
telemetría, los umbrales EUDR y las tarifas son off-chain: el programa **no re-evalúa
umbrales**, exige *autorización*.
→ [Arquitectura §7](docs/arquitectura/GroundTruth-Arquitectura-Tecnica-MVP.md)

**4. La cadena es la fuente de verdad de la tesorería; el webhook solo avisa.**
Un webhook se pierde. La reconciliación **lee la cadena**, y `saldo_cache` es un espejo que
**nunca se calcula sumando movimientos**. Si el aviso de Helius nunca llega, el sistema cuadra
igual.

**5. La atomicidad la da la transacción, no una instrucción gigante.**
Un despacho de N parcelas es **una sola transacción** de Solana con N `certify` + 1
`emit_manifest`. Si algo falla, revierte todo: **no hay cobro ni acuñación parcial.**

> [!IMPORTANT]
> **La documentación de [`docs/`](docs/) es la fuente de verdad de diseño.** Si el código y un
> documento divergen, el conflicto se resuelve **explícitamente** — no se ignora el documento.
> Todos ellos llevan una leyenda de estado (✅ construido y verificado · ⚠️ con matiz ·
> 🔜 pendiente) contrastada contra el código.

---

## Puesta en marcha

Requisitos: Node 22, pnpm, un proyecto Supabase. Para la capa on-chain: Rust y la CLI de
Solana (Agave).

```bash
# 1. Base de datos — aplicar supabase/migrations/ al proyecto Supabase
# 2. Backend
cd groundtruth-api && cp .env.example .env    # los comentarios explican cada variable
pnpm install && pnpm dev                      # http://localhost:3000
# 3. Frontend
cd groundtruth-web && cp .env.example .env
pnpm install && pnpm dev                      # http://localhost:5173
```

> [!TIP]
> **El sistema arranca sin cadena.** Sin las variables `SOLANA_*`, la certificación cae a una
> ruta *pre-Solana*: una transacción en la base que imita los efectos on-chain. Sirve para
> demos y desarrollo. Activar on-chain es **una decisión de entorno, no un cambio de código**.

Para levantar la capa on-chain completa en un validador local (USDC de prueba, árbol de
certificados y tesorería fondeada), ver [`groundtruth-api/README.md`](groundtruth-api/README.md).

---

## Estado real

**Funciona contra Postgres y contra la cadena, y está verificado** — no solo escrito:

- **Tres superficies completas:** Operador (13 vistas), Agricultor (dApp) y Admin (12 vistas).
- **Certificación on-chain:** cobro de USDC + acuñación del cNFT vía Bubblegum, en una sola
  transacción. **9 garantías verificadas** contra un validador real: cobro, acuñación,
  idempotencia sin doble cobro, techo de tarifa, atomicidad, reversión total, aislamiento entre
  tesorerías y fondos insuficientes.
- **Cadena de evidencia cerrada:** el SHA-256 recalculado sobre el PDF descargado de Storage
  coincide con el hash embebido en el GeoJSON de Arweave **y** con el grabado on-chain.
- **Verificador público:** por número, por *asset ID* o subiendo el PDF.

### Lo que falta, sin adornos

> [!WARNING]
> **La keypair que firma las acuñaciones está en un `.env` en texto plano.**
> Quien lea ese fichero —un desarrollador, una copia de seguridad, un servidor comprometido—
> **puede emitir certificados GroundTruth falsos**. Es el riesgo **F5** de los propios documentos
> de arquitectura. En producción va a **KMS/HSM**, y la Fase B (atestación TEE) lo reduce
> estructuralmente: una llave robada dejaría de bastar.

> [!CAUTION]
> **Arweave está en `devnet` (efímero, ~60 días). Pasar a `mainnet` es irreversible.**
> El GeoJSON contiene la **geolocalización exacta de las fincas** de los agricultores. Publicarlo
> en Arweave mainnet es **permanente y público para siempre**. Es una decisión de negocio
> deliberada (`IRYS_NETWORK=mainnet`), no un cambio de configuración descuidado.

| Pendiente | Detalle |
| :--- | :--- |
| **Imagen satelital** | El pipeline de Sentinel Hub está **cableado pero apagado**: faltan credenciales. Hasta entonces su hash va **en ceros** — *no se inventa*. |
| **Invitación de usuarios** | Los usuarios que crea el Admin nacen con un `auth_user_id` de relleno: **existen en el dominio pero no pueden iniciar sesión**. |
| **Realtime** | El diseño lo especifica; hoy la interfaz se actualiza por *refetch*. |
| **Despliegue** | Solana corre en un **validador local**. Devnet está pendiente de fondear la wallet. |

El cuaderno completo de estado y pendientes vive en `docs/ROADMAP.md` (no versionado).

---

## Pruebas

Tres capas, **cada una donde puede ser fiable**:

```bash
cd groundtruth-web && pnpm lint && pnpm test && pnpm build
cd groundtruth-api && pnpm typecheck && pnpm test && pnpm build
cd groundtruth-program && cargo build-sbf   # el e2e (9 garantías) necesita validador
```

El **CI** (GitHub Actions) corre lo determinista: lint, typecheck, tests unitarios, builds y la
compilación del programa. **No corre los tests de integración ni el e2e on-chain**: necesitan
una base y un validador vivos, serían intermitentes, y **un CI que falla a veces se acaba
ignorando** — y un CI ignorado no protege nada.

> [!NOTE]
> **La red de seguridad se validó saboteando el código.** Invertir las coordenadas lat/lng,
> cambiar una seed de PDA, borrar una clave de idioma, quitar una interpolación `{{n}}`:
> **todos detectados**. Un test que nunca falla no protege nada.

Detalle en [`TESTING.md`](TESTING.md).

---

## Documentación

| Documento | Contenido |
| :--- | :--- |
| [Arquitectura Técnica](docs/arquitectura/GroundTruth-Arquitectura-Tecnica-MVP.md) | Decisiones D1–D10, riesgos F1–F7, 7 diagramas |
| [Modelo de Datos](docs/producto/GroundTruth-Modelo-de-Datos.md) | 24 tablas, RLS, mapeo off-chain ↔ on-chain |
| [Casos de Uso por Rol](docs/producto/GroundTruth-Casos-de-Uso-por-Rol.md) | Visitante · Agricultor · Operador · Admin |
| [Gestión de Errores](docs/producto/GroundTruth-Gestion-de-Errores.md) | Taxonomía y los 26 códigos de dominio |
| [Índice de Vistas](docs/producto/GroundTruth-Indice-de-Vistas-y-Navegacion.md) | Las 37 rutas y sus guards |
| [Sistema de Diseño](docs/diseno/GroundTruth-Sistema-de-Diseno.md) | Paleta, tipografía, reglas de frontend e i18n |
