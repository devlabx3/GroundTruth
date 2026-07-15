# groundtruth-program — capa on-chain (Anchor / Solana)

Programa Anchor **nuevo y único** (Arquitectura §7, D9): el prototipo de devnet
(`initialize_farm` / `register_node` / `certify_reading`) certificaba *por lectura* y no
manejaba tesorería, cobro ni cNFTs; se reutilizan sus conceptos (PDAs determinísticas,
identidad `Farm`/`Parcel`) y el núcleo se parte limpio.

**Program ID (local/devnet):** `GQ7rQxCBvpfHMPkApAjQ2TjMxpGMhifK72tpi5ChnzMH`

## Qué vive aquí y qué no

On-chain viajan **el valor** (USDC), **las referencias** (URI de Arweave) y **las huellas**
(SHA-256). Los archivos pesados no. La telemetría, los umbrales EUDR y las tarifas son
**off-chain**: el programa **no re-evalúa umbrales** — exige *autorización* (firma del
backend en el MVP; atestación TEE en Fase B, ya presente como interruptor en `Config`).

## Cuentas (PDAs)

| Cuenta | Seeds | Rol |
| --- | --- | --- |
| `Config` | `["config"]` | Admin, firmante del backend, mint de USDC, **techos de cobro**, gate TEE |
| `Operator` | `["operator", operador_id]` | Identidad de la unidad |
| `Treasury` | `["treasury", operador_id]` | *Authority* de la tesorería; los USDC viven en su **ATA** |
| `Farm` | `["farm", finca_id]` | Gemelo digital de la finca |
| `Parcel` | `["parcel", parcela_id]` | Identidad de la parcela |
| `CertificateRecord` | `["cert", parcela_id, ciclo_id]` | **Idempotencia on-chain** |

Los `*_id` son los **UUID de Postgres tal cual** (16 bytes crudos): cada PDA es derivable
desde la base de datos sin guardar ningún mapeo — y por tanto sin poder desincronizarse.

## Instrucciones

`init_config` · `update_config` (rotación de llaves, F5) · `init_operator_treasury` ·
`set_operator_active` · `create_certificate_tree` · `register_farm` · `register_parcel` ·
`certify` · `emit_manifest`

### El cNFT (Bubblegum / ZK Compression)

`certify` mintea el certificado comprimido por **CPI a Bubblegum** (`mint_v1`):

- **El árbol lo controla el programa, no una wallet.** El *tree creator* es la PDA `Config`
  y el árbol es privado (`public: false`): **solo `certify` puede acuñar en él**, con sus
  reglas. Una keypair de backend comprometida no basta para fabricar un certificado.
- **El dueño del cNFT es la PDA de la unidad** (`Operator`): el certificado pertenece a
  quien lo pagó, no al firmante del backend.
- **`uri` = GeoJSON en Arweave** (que lleva los hashes embebidos, Arquitectura §11) y el programa
  firma como *creator verificado* → el certificado es auténtico y comprobable.
- `is_mutable: false`: un certificado no se reescribe. Su ciclo de vida (revocación,
  reemplazo) vive off-chain, como manda el diseño.
- El **asset ID** se deriva de (árbol, nonce) y se guarda en el `CertificateRecord`: la
  base de datos y la cadena quedan atadas por él.

Un árbol de profundidad 14 / buffer 64 aloja **16 384 certificados**. Cuando se llene,
basta crear otro con `create_certificate_tree` (el `CertificateRecord` guarda el asset ID,
así que no hay nada que migrar).

### Dos decisiones que conviene conocer

**1. La atomicidad la da la transacción, no una instrucción gigante.**
Un despacho de N parcelas se envía como **UNA transacción** con N instrucciones `certify`
\+ 1 `emit_manifest`. Solana ya garantiza que si cualquiera falla revierten todas, así que
meter N certificados dentro de una sola instrucción (con `remaining_accounts`) sería más
frágil sin ganar nada. Verificado en la prueba 5.

**2. Techos de cobro on-chain (`max_cert_fee`, `max_manifest_fee`).**
Las tarifas son un parámetro *off-chain* (las edita el Admin y viajan como argumento
firmado por el backend). Sin un techo, una keypair de backend comprometida (riesgo F5)
podría vaciar una tesorería en una sola llamada. El techo acota el daño por transacción
y **no contradice el diseño**: la tarifa sigue siendo configurable, solo que acotada.

## Estado

| Pieza | Estado |
| --- | --- |
| Tesorería por operador (PDA + ATA) y aislamiento | ✔ |
| Cobro Pay-per-Proof (certificación + manifiesto) | ✔ USDC real por CPI a SPL Token |
| Idempotencia por `(parcela, ciclo)` | ✔ vía `init` del `CertificateRecord` |
| Atomicidad del despacho | ✔ |
| **Mint del cNFT (CPI a Bubblegum)** | ✔ |
| Gate de atestación TEE (Fase B) | ✔ como interruptor (`attestation_required`, hoy `false`) |

**El programa está completo para el MVP.** Lo que queda es de integración, no de diseño.

## Compilar y probar

No hace falta el CLI de Anchor para compilar ni para probar: basta `cargo build-sbf`, que
viene con el CLI de Solana (Agave). El CLI de Anchor solo se necesita para generar el IDL
(que consumirá el backend) y para los tests en TypeScript.

```bash
cargo build-sbf                     # produce target/deploy/groundtruth.so

# El validador necesita los programas de Metaplex/compresión: se clonan de mainnet.
solana-test-validator --reset --quiet \
  --url https://api.mainnet-beta.solana.com \
  --clone-upgradeable-program BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY \
  --clone-upgradeable-program cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK \
  --clone-upgradeable-program noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV &

solana program deploy target/deploy/groundtruth.so \
  --program-id target/deploy/groundtruth-keypair.json --url localhost
cd client && cargo run --bin e2e    # 9 comprobaciones
```

`client/` no comprueba que el código corra: comprueba las **garantías** que justifican
poner esto on-chain — cobro real, mint del cNFT (con asset ID derivado del árbol y nonce
que avanza), idempotencia sin doble cobro ni doble mint, techo de tarifa, atomicidad del
despacho, reversión completa ante fallo, aislamiento entre tesorerías y fondos insuficientes.

## Gotchas que costaron tiempo (para quien venga después)

- **`mpl-bubblegum` 3.0 no sirve con Anchor 0.31:** arrastra `solana-program` 3.x mientras
  Anchor usa 2.x, y sus `AccountInfo`/`Pubkey` dejan de ser el mismo tipo. Hay que fijar
  **`mpl-bubblegum = "2.0.0"`** (sin la feature `anchor`, que no existe en 2.x).
- **`anchor build` exige `solana_version = "3.1.13"` en `Anchor.toml`.** Por defecto Anchor
  0.31.1 instala las platform-tools de Solana **2.1.0, cuyo Rust es 1.79** y no entiende
  `edition2024` — que ya exigen varias dependencias transitivas (`toml_datetime`,
  `block-buffer`…). Ir fijando esas crates una a una es un pozo sin fondo; la solución es
  darle a Anchor unas platform-tools con Rust nuevo. **Ojo: `avm`/`anchor` reescriben el
  CLI de Solana del sistema** (lo bajaron de 3.1.13 a 2.1.0 al instalarse); con esta línea
  vuelve a la 3.1.13.
- **`proc-macro-crate` pineado a 3.2.0** en `Cargo.lock` por la misma razón (la 3.5 arrastra
  `toml_edit` 0.25 → `toml_datetime` 1.1, que es edition2024).
- **El alias de tipo rompe `InitSpace`:** un `type Uuid = [u8; 16]` no compila en una
  cuenta; el derive necesita el array literal `[u8; 16]`.
- **Stack de 4 KB:** `Certify` tiene muchas cuentas; sin `Box<>` en las pesadas revienta
  con *Access violation in stack frame*.
- **Compute units:** el mint comprimido no cabe en los 200 k por defecto — el cliente debe
  pedir presupuesto extra (`ComputeBudgetInstruction`).

## IDL

`anchor build` genera `target/idl/groundtruth.json` y `target/types/groundtruth.ts`
(9 instrucciones, 6 cuentas, 4 eventos, 7 errores). Es lo que consume `groundtruth-api`
para construir las transacciones con `@coral-xyz/anchor`.

## Pendiente para conectarlo al backend

1. **Sustituir el certify pre-Solana** de `groundtruth-api/src/embarques/embarques.service.ts`
   (hoy una transacción DB que imita los efectos on-chain) por el envío de la TX real, y
   guardar el `asset_id` devuelto en `certificados.cnft_asset_id`.
2. **Subida a Arweave** del GeoJSON (Irys) para tener el `uri` real, y del PDF/imagen a
   Supabase Storage para calcular sus hashes.
3. **Custodia de la keypair del backend** en KMS/HSM, nunca en `.env` plano (F5).
4. **Devnet:** el faucet público está limitado; el despliegue queda pendiente de fondear la
   wallet (~5,5 SOL). Todo lo verificado corre en un validador local, que es el mismo runtime.
