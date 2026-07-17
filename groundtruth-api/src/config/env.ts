import { z } from 'zod';

/** Validación de entorno al arrancar: fallar temprano y con claridad. */
const schema = z.object({
  PORT: z.coerce.number().default(3000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  SUPABASE_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  HELIUS_API_KEY: z.string().optional(),
  /** Secreto compartido del webhook de depósitos. Sin él, el endpoint queda CERRADO. */
  HELIUS_WEBHOOK_SECRET: z.string().optional(),
  /** Secreto compartido de ingesta IoT (POST /telemetria/ingest). Sin él, el endpoint queda CERRADO. */
  TELEMETRIA_INGEST_SECRET: z.string().optional(),

  /** Storage (evidencia): PDF del certificado e imagen satelital. */
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  /** Sentinel Hub (Copernicus). Sin credenciales no hay imagen ni su hash. */
  SENTINEL_CLIENT_ID: z.string().optional(),
  SENTINEL_CLIENT_SECRET: z.string().optional(),
  SENTINEL_BASE_URL: z.string().url().optional(),

  /**
   * Arweave vía Irys. `devnet` (por defecto) es efímero: los datos caducan.
   * `mainnet` publica la geolocalización de las fincas de forma PERMANENTE e
   * irreversible — es una decisión explícita, no un descuido de configuración.
   */
  IRYS_NETWORK: z.enum(['devnet', 'mainnet']).optional(),

  // Capa on-chain. Si falta CUALQUIERA de las variables del cluster activo, la
  // certificación cae a su ruta pre-Solana (transacción en BD): el sistema sigue
  // usable sin cadena, y pasar a on-chain es una decisión de entorno, no de código.
  //
  // SWITCH DE CLUSTER: `SOLANA_CLUSTER` elige de qué bloque leer (DEVNET/LOCALNET).
  // Cambiarlo (y reiniciar) alterna devnet ↔ localnet sin tocar el resto del .env.
  SOLANA_CLUSTER: z.enum(['devnet', 'localnet']).optional(),
  /** Keypair custodial del backend (F5): array JSON de 64 bytes. Compartida entre clusters. En producción, KMS/HSM. */
  SOLANA_BACKEND_SECRET_KEY: z.string().optional(),

  // devnet (objetivo)
  SOLANA_DEVNET_RPC_URL: z.string().url().optional(),
  SOLANA_DEVNET_USDC_MINT: z.string().optional(),
  SOLANA_DEVNET_MERKLE_TREE: z.string().optional(),
  SOLANA_DEVNET_PLATAFORMA_ATA: z.string().optional(),

  // localnet (depuración; faucet ilimitado)
  SOLANA_LOCALNET_RPC_URL: z.string().url().optional(),
  SOLANA_LOCALNET_USDC_MINT: z.string().optional(),
  SOLANA_LOCALNET_MERKLE_TREE: z.string().optional(),
  SOLANA_LOCALNET_PLATAFORMA_ATA: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const detalle = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Variables de entorno inválidas — ${detalle}`);
  }
  return parsed.data;
}
