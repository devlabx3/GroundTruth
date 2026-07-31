# Devnet — estado y runbook

**Desplegado y funcionando el 2026-07-30.** El backend arranca con
`Solana activa [devnet] — programa GQ7rQxCBvpfHMPkApAjQ2TjMxpGMhifK72tpi5ChnzMH`.

Este documento describe el despliegue tal como quedó y cómo reproducirlo.

---

## Direcciones on-chain

| Qué | Dirección |
| --- | --- |
| Programa | `GQ7rQxCBvpfHMPkApAjQ2TjMxpGMhifK72tpi5ChnzMH` |
| ProgramData | `5dRPgfSdeFywQqSrQp2cQ3tgiX6dmKTjYPTr3TCWEiF` |
| Upgrade authority | `B3fx5yAmMYkJyNh4pR2BZrSEtG2tsjF434VUEHBbfqWX` |
| `Config` | `Diybt6e3rgqzPwUe8pCsNJht6nqx7y4fRiG7vJKvJ4bp` |
| USDC de prueba (mint) | `3Dxj1sP3QkZK3MUxa2yAQjnrNuJsbkcQ4C3vqR5jeDex` |
| Árbol de certificados | `2mtAKSPXkAMt3pgfdqGJuBWTDvTk76B85GDVKewDLFF3` (16 384 certificados) |
| ATA de ingresos | `5bFHRaG6TFfe9NWq4Qhsiv3udDsCY1VvMEC7qhWpX24P` |

Unidad `11111111-1111-1111-1111-111111111111`:

| Qué | Dirección |
| --- | --- |
| `Operator` | `A65zPg8AYe2VLR2nKQZa9b2CmEfMUmwAyhLDyH8KD9uP` |
| `Treasury` | `FStyGZ92nCDQue6VceeSH21mZFGBtKsMwQq26KaiyoG7` |
| ATA (aquí deposita) | `feEJzopZStr5V77zhyn98wFX3oXXYophzDdquEXR2eo` — 5 000 USDC |

## Wallets

| Rol | Dirección | Fichero | Saldo |
| --- | --- | --- | --- |
| Despliegue / upgrade authority | `B3fx5yAmMYkJyNh4pR2BZrSEtG2tsjF434VUEHBbfqWX` | `~/deploy-devnet.json` | ~604 SOL |
| Backend custodial (firma certify) | `HXTJyfpZky2TgpLn54npiVZNkr1qRKu7D6LDGSNjSuYa` | `~/backend-devnet.json` + `.env` | ~10 SOL |
| Programa (ya no paga fees) | `GQ7rQx…nzMH` | `keys/groundtruth-keypair.json` | 3.03 SOL (renta) |

Ambos ficheros con `chmod 600`. Ninguno está en git (`.gitignore` cubre `keys/` y `.env`).

---

## La keypair compartida: por qué hubo que separarla

Antes del despliegue, `keys/groundtruth-keypair.json` y `SOLANA_BACKEND_SECRET_KEY`
tenían **bytes idénticos**: el programa y el firmante del backend eran la misma cuenta.
El README lo daba por tolerable hasta mainnet. **No lo era: en devnet es un bloqueo
técnico, no solo un riesgo.**

Al desplegar, esa cuenta pasa a ser propiedad del BPF Loader y `executable: true`.
Solana **prohíbe que una cuenta ejecutable pague fees**, así que el bootstrap murió con
`This account may not be used to pay transaction fees`.

La solución fue generar `~/backend-devnet.json` y apuntar ahí
`SOLANA_BACKEND_SECRET_KEY`. Efecto secundario deseable: la *upgrade authority* quedó en
la wallet de despliegue, separada del firmante del backend. Comprometer el backend ya no
da control sobre el código on-chain — el riesgo F5 quedó acotado.

Queda pendiente de F5 llevar la keypair del backend a KMS/HSM (hoy vive en disco).

## Otro bloqueo: la cuenta del programa tenía saldo

`solana program deploy` falló con `Account … is not an upgradeable program or already in
use`: la cuenta tenía 612 SOL como cuenta de sistema, y el BPF Loader exige que esté
vacía. Se barrió con `solana transfer … ALL` hacia la wallet de despliegue y el deploy
pasó. **Los fondos no se perdieron**, solo cambiaron de sitio.

---

## Reproducir desde cero

Requiere un Program ID nuevo: devnet persiste y el bootstrap aborta si `Config` ya existe.

### 0. Comprobar que los tres IDs coinciden

```bash
cd groundtruth-program
grep -oP 'declare_id!\("\K[^"]+' programs/groundtruth/src/lib.rs
solana address -k target/deploy/groundtruth-keypair.json
node -e "console.log(JSON.parse(require('fs').readFileSync('target/idl/groundtruth.json','utf8')).address)"
```

Si difieren, corregir antes de seguir: `cargo-build-sbf` **no** sobrescribe la keypair de
`target/deploy/` si ya existe, y el bootstrap lee el IDL de `target/idl/`. Con IDs
distintos, el bootstrap crea la tesorería en una PDA que el backend nunca consulta.

### 1. Compilar

```bash
cargo-build-sbf
```

No usar `anchor build`: falla con `Failed to list installed solana versions` porque el
toolchain instalado (Solana 4.0.1 / Anchor 1.0.1) es más nuevo que lo que declara
`Anchor.toml` (3.1.13 / 0.31.1).

### 2. Desplegar

La cuenta del programa debe estar **vacía**. Si tiene saldo:

```bash
solana transfer <wallet-deploy> ALL \
  --from keys/groundtruth-keypair.json --fee-payer keys/groundtruth-keypair.json \
  --url https://api.devnet.solana.com
```

```bash
solana program deploy target/deploy/groundtruth.so \
  --program-id target/deploy/groundtruth-keypair.json \
  --keypair ~/deploy-devnet.json \
  --url https://api.devnet.solana.com
```

Coste: ~3.04 SOL de renta.

### 3. Keypair del backend — distinta de la del programa

```bash
solana-keygen new --no-bip39-passphrase --outfile ~/backend-devnet.json
chmod 600 ~/backend-devnet.json
solana transfer $(solana address -k ~/backend-devnet.json) 10 \
  --from ~/deploy-devnet.json --fee-payer ~/deploy-devnet.json \
  --url https://api.devnet.solana.com --allow-unfunded-recipient
```

Volcar sus 64 bytes en `SOLANA_BACKEND_SECRET_KEY` del `.env`.

### 4. Bootstrap

```bash
cd ../groundtruth-api
node scripts/bootstrap-solana.mjs \
  11111111-1111-1111-1111-111111111111 \
  https://api.devnet.solana.com 5000
```

Crea USDC de prueba, `Config`, árbol y tesorería, y actualiza la fila de `tesorerias`.
Bubblegum, SPL Account Compression y SPL Noop son nativos en devnet: no hay que clonarlos.

### 5. `.env` y arranque

```dotenv
SOLANA_CLUSTER=devnet
SOLANA_DEVNET_RPC_URL=https://api.devnet.solana.com
SOLANA_DEVNET_USDC_MINT=<del bootstrap>
SOLANA_DEVNET_MERKLE_TREE=<del bootstrap>
SOLANA_DEVNET_PLATAFORMA_ATA=<del bootstrap>
```

```bash
pnpm dev
```

Debe aparecer `Solana activa [devnet] — programa GQ7rQx…`. Si sale
`Solana [devnet] no configurada`, falta alguna de las cuatro variables o la keypair.

---

## Volver a localnet

```dotenv
SOLANA_CLUSTER=localnet
```

Y reiniciar. El bloque `SOLANA_DEVNET_*` se queda intacto para volver cuando haga falta.

Aviso: `SOLANA_BACKEND_SECRET_KEY` es **compartida entre clusters**. La keypair actual
(`HXTJyfp…`) no tiene saldo en localnet; hay que airdropearla o re-bootstrapear en local.
