import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResultRow } from 'pg';

/** Cliente ligado a una transacción; misma firma de consulta que DbService. */
export interface Tx {
  query<T extends QueryResultRow>(sql: string, params?: unknown[]): Promise<T[]>;
  queryOne<T extends QueryResultRow>(sql: string, params?: unknown[]): Promise<T | null>;
}

/**
 * Acceso a Postgres con el rol de servicio (omite RLS): este backend es quien
 * autoriza por privilegios de sub-rol (Modelo-de-Datos §7). Sin ORM: el esquema
 * vive en supabase/migrations y las consultas son SQL explícito.
 */
@Injectable()
export class DbService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(config: ConfigService) {
    const connectionString = config.getOrThrow<string>('DATABASE_URL');
    // Supabase exige TLS; Postgres local (dev sin SSL) no. Heurística por host.
    // `rejectUnauthorized: false` acepta la cadena del pooler de Supabase (MVP);
    // para endurecer, fijar el CA de Supabase en lugar de deshabilitar la verificación.
    const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])/.test(connectionString);
    this.pool = new Pool({
      connectionString,
      max: 10,
      ssl: isLocal ? undefined : { rejectUnauthorized: false },
    });
  }

  async query<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    const { rows } = await this.pool.query<T>(sql, params);
    return rows;
  }

  async queryOne<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] ?? null;
  }

  /**
   * Ejecuta `fn` dentro de una transacción: commit si resuelve, rollback si
   * lanza. La certificación (débito de tesorería + emisión) debe ser atómica —
   * nunca un cobro sin certificado ni viceversa (idempotencia, Errores §5).
   */
  async transaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R> {
    const client: PoolClient = await this.pool.connect();
    const tx: Tx = {
      query: async (sql, params = []) => (await client.query(sql, params)).rows,
      queryOne: async (sql, params = []) => (await client.query(sql, params)).rows[0] ?? null,
    };
    try {
      await client.query('BEGIN');
      const result = await fn(tx);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  onModuleDestroy() {
    return this.pool.end();
  }
}
