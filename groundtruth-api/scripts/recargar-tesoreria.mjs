/**
 * Recarga la tesorería de un operador con USDC de prueba (herramienta de DEV, no prod).
 *
 * En PRODUCCIÓN el operador deposita USDC real desde su wallet al ATA de su tesorería;
 * el backend no mueve nada, solo reconcilia. Aquí, como el USDC de prueba lo controla el
 * backend (es la autoridad del mint), se ACUÑA directo al ATA para simular ese depósito.
 *
 * NO toca `saldo_cache` en la BD a propósito: el nuevo saldo aparece cuando el operador
 * abre /tesoreria (que reconcilia contra la cadena) o pulsa «Sincronizar». Así se prueba
 * el flujo real de detección, no un número escrito a mano.
 *
 *   node scripts/recargar-tesoreria.mjs <operador_id> <usdc>
 */
import { readFileSync } from 'node:fs';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { createMintToInstruction } from '@solana/spl-token';
import pg from 'pg';

const OPERADOR_ID = process.argv[2];
const USDC = Number(process.argv[3]);
if (!OPERADOR_ID || !Number.isFinite(USDC) || USDC <= 0) {
  console.error('uso: node scripts/recargar-tesoreria.mjs <operador_id> <usdc>');
  process.exit(1);
}
const MICRO = 1_000_000;

// El script no usa dotenv: lee el .env de groundtruth-api a mano.
const ENV = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const envVar = (k) => {
  const m = ENV.match(new RegExp('^' + k + '=(.*)$', 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : undefined;
};

// Resuelve por el switch de cluster (SOLANA_CLUSTER → bloque DEVNET/LOCALNET).
const CLUSTER = (envVar('SOLANA_CLUSTER') ?? 'devnet').toUpperCase();
const RPC = envVar(`SOLANA_${CLUSTER}_RPC_URL`);
const mintStr = envVar(`SOLANA_${CLUSTER}_USDC_MINT`);
const secret = envVar('SOLANA_BACKEND_SECRET_KEY');
if (!RPC || !mintStr || !secret) {
  console.error(`✗ Faltan SOLANA_${CLUSTER}_RPC_URL / SOLANA_${CLUSTER}_USDC_MINT / SOLANA_BACKEND_SECRET_KEY en el .env.`);
  console.error('  ¿Ya corriste el bootstrap y pegaste sus variables?');
  process.exit(1);
}
const mint = new PublicKey(mintStr);
const backend = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));
const connection = new Connection(RPC, 'confirmed');

// El ATA de la tesorería (donde deposita el operador) vive en la fila de `tesorerias`.
const client = new pg.Client({
  connectionString: envVar('DATABASE_URL'),
  ssl: { rejectUnauthorized: false },
});
await client.connect();
const { rows } = await client.query(
  'select ata_usdc from tesorerias where operador_id = $1',
  [OPERADOR_ID],
);
await client.end();
if (!rows[0]) {
  console.error(`✗ El operador ${OPERADOR_ID} no tiene tesorería. Corre primero el bootstrap.`);
  process.exit(1);
}
const ata = new PublicKey(rows[0].ata_usdc);

console.log(`Acuñando ${USDC} USDC de prueba al ATA ${ata.toBase58()} …`);
const sig = await sendAndConfirmTransaction(
  connection,
  new Transaction().add(
    createMintToInstruction(mint, ata, backend.publicKey, BigInt(Math.round(USDC * MICRO))),
  ),
  [backend],
);
console.log('  firma:', sig);
console.log('  Listo. El saldo se actualizará cuando el operador abra /tesoreria (o pulse «Sincronizar»).');
