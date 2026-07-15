/**
 * Arranca el estado on-chain de GroundTruth en un validador (local o devnet):
 * USDC de prueba, `Config`, árbol de certificados y la tesorería de una unidad,
 * fondeada. Deja la fila de `tesorerias` apuntando a las direcciones REALES y
 * escupe el bloque de variables para el `.env`.
 *
 *   node scripts/bootstrap-solana.mjs <operador_id> [rpc] [usdc_a_fondear]
 *   # local:  node scripts/bootstrap-solana.mjs <op>
 *   # devnet: node scripts/bootstrap-solana.mjs <op> https://api.devnet.solana.com 5000
 *
 * LOCAL vs DEVNET/MAINNET (detectado por el RPC):
 *   - El firmante del backend se REUTILIZA de `SOLANA_BACKEND_SECRET_KEY` (.env) si existe;
 *     solo en local, si falta, se genera. Debe estar FONDEADO de antemano en devnet/mainnet
 *     (no hay faucet ilimitado); en local se airdropea solo.
 *   - Bubblegum / compression / noop existen nativos en devnet: NO hace falta clonarlos
 *     (eso solo era para el validador local, vía Anchor.toml [test.validator]).
 *
 * Es una herramienta de desarrollo: en producción la tesorería la crea el Admin
 * al dar de alta la unidad, y el USDC lo deposita el operador.
 */
import { readFileSync } from 'node:fs';
import anchor from '@coral-xyz/anchor';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
} from '@solana/spl-token';
import pg from 'pg';

const { AnchorProvider, BN, Program, Wallet } = anchor;

const OPERADOR_ID = process.argv[2];
const RPC = process.argv[3] ?? 'http://127.0.0.1:8899';
const FONDEO_USDC = Number(process.argv[4] ?? 1000);
if (!OPERADOR_ID) {
  console.error('uso: node scripts/bootstrap-solana.mjs <operador_id> [rpc] [usdc]');
  process.exit(1);
}

const MICRO = 1_000_000;
const COMPRESSION_ID = new PublicKey('cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK');
const NOOP_ID = new PublicKey('noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV');
const BUBBLEGUM_ID = new PublicKey('BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY');
// Profundidad 14 / buffer 64 → 16 384 certificados por árbol.
const MAX_DEPTH = 14;
const MAX_BUFFER = 64;
const TREE_SIZE = 31800;

const IDL = JSON.parse(
  readFileSync(new URL('../../groundtruth-program/target/idl/groundtruth.json', import.meta.url)),
);

const uuidBytes = (u) => Buffer.from(u.replace(/-/g, ''), 'hex');

// El script no usa dotenv: lee el .env de groundtruth-api a mano.
const ENV_TEXT = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const envVar = (k) => {
  const m = ENV_TEXT.match(new RegExp('^' + k + '=(.*)$', 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : undefined;
};

const esLocal = RPC.includes('127.0.0.1') || RPC.includes('localhost');
const red = RPC.includes('mainnet') ? 'mainnet' : 'devnet';

const connection = new Connection(RPC, 'confirmed');

// La keypair custodial del backend (F5). En producción: KMS/HSM, nunca en disco.
// En devnet/mainnet se REUTILIZA la del .env (SOLANA_BACKEND_SECRET_KEY), que ya está
// fondeada y es la que firmará en runtime; solo en local, si no hay ninguna, se genera.
const secretEnv = envVar('SOLANA_BACKEND_SECRET_KEY');
const backend = secretEnv
  ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secretEnv)))
  : Keypair.generate();
console.log(
  'Backend authority:',
  backend.publicKey.toBase58(),
  secretEnv ? '(reutilizada del .env)' : '(generada — es local)',
);

const provider = new AnchorProvider(connection, new Wallet(backend), {
  commitment: 'confirmed',
});
const program = new Program(IDL, provider);
const pid = program.programId;
const pda = (seeds) => PublicKey.findProgramAddressSync(seeds, pid)[0];

// Devnet PERSISTE (a diferencia de localnet, que se resetea al reiniciar): si este
// programa ya se bootstrapeó, `init_config` fallaría con un error críptico. Avisamos claro.
const configPda = pda([Buffer.from('config')]);
if (await connection.getAccountInfo(configPda)) {
  console.error(`\n✗ El Config ${configPda.toBase58()} ya existe en ${red}: el programa ya está inicializado.`);
  console.error('  Para re-bootstrapear necesitas un programa recién desplegado (o cerrar las cuentas on-chain). Abortando.');
  process.exit(1);
}

async function airdrop(pk, sol) {
  const sig = await connection.requestAirdrop(pk, sol * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(sig, 'confirmed');
}

console.log('\n1. Firmante del backend…');
const saldo = await connection.getBalance(backend.publicKey);
const NECESARIO = 0.4 * LAMPORTS_PER_SOL; // renta del árbol (~0.22) + mint + fees, con margen
console.log(`   saldo: ${(saldo / LAMPORTS_PER_SOL).toFixed(3)} SOL`);
if (saldo < NECESARIO) {
  if (esLocal) {
    console.log('   fondeando por airdrop (validador local)…');
    await airdrop(backend.publicKey, 5);
  } else {
    // En devnet/mainnet no hay faucet ilimitado: la llave se fondea a mano ANTES.
    console.error(`   ✗ Saldo insuficiente para el bootstrap (hacen falta ~0.4 SOL).`);
    console.error(`   Fondea ${backend.publicKey.toBase58()} en ${red} y reintenta. Ej.:`);
    console.error(`     solana transfer ${backend.publicKey.toBase58()} 2 --from ~/deploy-devnet.json --fee-payer ~/deploy-devnet.json --url ${RPC} --allow-unfunded-recipient`);
    process.exit(1);
  }
}

console.log('2. Creando el USDC de prueba (6 decimales)…');
const mint = Keypair.generate();
const plataformaAta = getAssociatedTokenAddressSync(mint.publicKey, backend.publicKey);
await sendAndConfirmTransaction(
  connection,
  new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: backend.publicKey,
      newAccountPubkey: mint.publicKey,
      space: MINT_SIZE,
      lamports: await getMinimumBalanceForRentExemptMint(connection),
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMintInstruction(mint.publicKey, 6, backend.publicKey, null),
    createAssociatedTokenAccountInstruction(
      backend.publicKey,
      plataformaAta,
      backend.publicKey,
      mint.publicKey,
    ),
  ),
  [backend, mint],
);
console.log('   USDC mint:', mint.publicKey.toBase58());
console.log('   ATA de ingresos de la plataforma:', plataformaAta.toBase58());

console.log('3. init_config (techos de cobro: 50 / 20 USDC)…');
await program.methods
  .initConfig(backend.publicKey, new BN(50 * MICRO), new BN(20 * MICRO))
  .accountsPartial({
    admin: backend.publicKey,
    config: configPda,
    usdcMint: mint.publicKey,
    systemProgram: SystemProgram.programId,
  })
  .rpc();

console.log('4. Creando el árbol de certificados…');
const tree = Keypair.generate();
const treeConfig = PublicKey.findProgramAddressSync(
  [tree.publicKey.toBuffer()],
  BUBBLEGUM_ID,
)[0];
const crearArbol = new Transaction().add(
  SystemProgram.createAccount({
    fromPubkey: backend.publicKey,
    newAccountPubkey: tree.publicKey,
    space: TREE_SIZE,
    lamports: await connection.getMinimumBalanceForRentExemption(TREE_SIZE),
    programId: COMPRESSION_ID,
  }),
  await program.methods
    .createCertificateTree(MAX_DEPTH, MAX_BUFFER)
    .accountsPartial({
      payer: backend.publicKey,
      config: configPda,
      backendAuthority: backend.publicKey,
      treeConfig,
      merkleTree: tree.publicKey,
      logWrapper: NOOP_ID,
      compressionProgram: COMPRESSION_ID,
      bubblegumProgram: BUBBLEGUM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction(),
);
await sendAndConfirmTransaction(connection, crearArbol, [backend, tree]);
console.log('   árbol:', tree.publicKey.toBase58(), `(${1 << MAX_DEPTH} certificados)`);

console.log('5. init_operator_treasury para la unidad…');
const operatorPda = pda([Buffer.from('operator'), uuidBytes(OPERADOR_ID)]);
const treasuryPda = pda([Buffer.from('treasury'), uuidBytes(OPERADOR_ID)]);
const treasuryAta = getAssociatedTokenAddressSync(mint.publicKey, treasuryPda, true);
await program.methods
  .initOperatorTreasury([...uuidBytes(OPERADOR_ID)], backend.publicKey)
  .accountsPartial({
    payer: backend.publicKey,
    config: configPda,
    operator: operatorPda,
    treasury: treasuryPda,
    usdcMint: mint.publicKey,
    treasuryAta,
    tokenProgram: TOKEN_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  })
  .rpc();
console.log('   Treasury PDA:', treasuryPda.toBase58());
console.log('   ATA (aquí deposita el operador):', treasuryAta.toBase58());

console.log(`6. Fondeando la tesorería con ${FONDEO_USDC} USDC de prueba…`);
await sendAndConfirmTransaction(
  connection,
  new Transaction().add(
    createMintToInstruction(
      mint.publicKey,
      treasuryAta,
      backend.publicKey,
      BigInt(FONDEO_USDC * MICRO),
    ),
  ),
  [backend],
);

console.log('7. Apuntando la fila de `tesorerias` a las direcciones reales…');
const dbUrl = envVar('DATABASE_URL');
const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query(
  `insert into tesorerias (operador_id, treasury_pda, ata_usdc, red, saldo_cache, actualizado_en)
   values ($1, $2, $3, $4, $5, now())
   on conflict (operador_id) do update
     set treasury_pda = excluded.treasury_pda,
         ata_usdc     = excluded.ata_usdc,
         red          = excluded.red,
         saldo_cache  = excluded.saldo_cache,
         actualizado_en = now()`,
  [OPERADOR_ID, treasuryPda.toBase58(), treasuryAta.toBase58(), red, FONDEO_USDC * MICRO],
);
await client.end();

// Variables PREFIJADAS por cluster (el switch SOLANA_CLUSTER elige el bloque).
const PREF = esLocal ? 'LOCALNET' : 'DEVNET';
console.log('\n' + '='.repeat(64));
console.log('Actualiza esto en el .env de groundtruth-api y reinicia:\n');
console.log(`SOLANA_CLUSTER=${esLocal ? 'localnet' : 'devnet'}   # <- el switch: apunta al bloque de abajo`);
if (secretEnv) console.log('SOLANA_BACKEND_SECRET_KEY  (sin cambios — compartida entre clusters)');
else console.log(`SOLANA_BACKEND_SECRET_KEY=[${backend.secretKey.toString()}]`);
console.log(`SOLANA_${PREF}_RPC_URL=${RPC}`);
console.log(`SOLANA_${PREF}_USDC_MINT=${mint.publicKey.toBase58()}`);
console.log(`SOLANA_${PREF}_MERKLE_TREE=${tree.publicKey.toBase58()}`);
console.log(`SOLANA_${PREF}_PLATAFORMA_ATA=${plataformaAta.toBase58()}`);
console.log('='.repeat(64));
