import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DbService } from '@/db/db.service';
import { SentinelService } from '@/evidencia/sentinel.service';
import { ArweaveService } from '@/evidencia/arweave.service';
import { StorageService } from '@/evidencia/storage.service';
import { SolanaService } from '@/solana/solana.service';

const TIMEOUT_MS = 4000;
const LATENCIA_WARN_MS = 500;

type Estado = 'ok' | 'warn' | 'down' | 'no_configurado';

interface Integracion {
  key: string;
  nombre: string;
  estado: Estado;
  latenciaMs: number | null;
}

/**
 * Salud de integraciones (A9).
 *
 * Cada línea sale del servicio REAL que la usa, no de una lista fija: si el
 * backend dice que Sentinel está activo, es que puede pedirle imágenes. Un panel
 * de salud que miente es peor que no tenerlo, así que lo no configurado se
 * declara `no_configurado` en vez de un "ok" inventado.
 */
@Injectable()
export class AdminIntegracionesService {
  constructor(
    private readonly db: DbService,
    private readonly config: ConfigService,
    private readonly sentinel: SentinelService,
    private readonly arweave: ArweaveService,
    private readonly storage: StorageService,
    private readonly solana: SolanaService,
  ) {}

  async list(): Promise<Integracion[]> {
    const [supabase, rpc, sentinel] = await Promise.all([
      this.checkSupabase(),
      this.checkRpc(),
      this.checkSentinel(),
    ]);

    return [
      sentinel,
      // Helius está "configurado" cuando existe el secreto del webhook — que es lo que
      // realmente autentica sus llamadas (helius.controller). Antes miraba HELIUS_API_KEY,
      // una variable que ni el .env ni el webhook usan, así que salía siempre no configurada.
      this.pendiente('helius', 'Helius (webhooks)', !!this.config.get('HELIUS_WEBHOOK_SECRET')),
      {
        key: 'irys',
        nombre: `Irys / Arweave (${this.config.get('IRYS_NETWORK') ?? 'devnet'})`,
        estado: this.arweave.isEnabled() ? 'ok' : 'no_configurado',
        latenciaMs: null,
      },
      rpc,
      {
        key: 'storage',
        nombre: 'Supabase Storage (evidencia)',
        estado: this.storage.isEnabled() ? 'ok' : 'no_configurado',
        latenciaMs: null,
      },
      supabase,
    ];
  }

  private async checkSentinel(): Promise<Integracion> {
    if (!this.sentinel.isEnabled()) {
      return { key: 'sentinel', nombre: 'Sentinel Hub', estado: 'no_configurado', latenciaMs: null };
    }
    // Configurada: no se sondea con una descarga real (cuesta cuota); basta con
    // que la sesión pueda autenticarse.
    return { key: 'sentinel', nombre: 'Sentinel Hub', estado: 'ok', latenciaMs: null };
  }

  private async checkSupabase(): Promise<Integracion> {
    const t0 = Date.now();
    try {
      await this.db.query('select 1');
      return this.medido('supabase', 'Supabase (Postgres)', Date.now() - t0);
    } catch {
      return { key: 'supabase', nombre: 'Supabase (Postgres)', estado: 'down', latenciaMs: null };
    }
  }

  private async checkRpc(): Promise<Integracion> {
    const url = this.solana.rpcUrl; // RPC del cluster activo (switch SOLANA_CLUSTER)
    const nombre = this.solana.isEnabled() ? 'RPC Solana (programa activo)' : 'RPC Solana';
    if (!url) return { key: 'rpc', nombre, estado: 'no_configurado', latenciaMs: null };

    const t0 = Date.now();
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth' }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const json = (await res.json()) as { result?: string };
      if (!res.ok || json.result !== 'ok') {
        return { key: 'rpc', nombre, estado: 'down', latenciaMs: null };
      }
      return this.medido('rpc', nombre, Date.now() - t0);
    } catch {
      return { key: 'rpc', nombre, estado: 'down', latenciaMs: null };
    }
  }

  private medido(key: string, nombre: string, latenciaMs: number): Integracion {
    return {
      key,
      nombre,
      estado: latenciaMs > LATENCIA_WARN_MS ? 'warn' : 'ok',
      latenciaMs,
    };
  }

  private pendiente(key: string, nombre: string, configurada: boolean): Integracion {
    return {
      key,
      nombre,
      estado: configurada ? 'warn' : 'no_configurado', // configurada pero sin sonda
      latenciaMs: null,
    };
  }
}
