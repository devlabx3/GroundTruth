import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { DbService } from '@/db/db.service';
import { DomainErrors } from '@/common/domain-error';

const patchSchema = z.object({
  nombre: z.string().trim().min(1),
  pais: z.string().trim().length(2),
  idiomaDefecto: z.string().trim().length(2),
});

/** Perfil de la unidad (O10). */
@Injectable()
export class UnidadService {
  constructor(private readonly db: DbService) {}

  async get(operadorId: string) {
    const o = await this.db.queryOne<any>(
      'select nombre, pais, idioma_defecto from operadores where id = $1',
      [operadorId],
    );
    if (!o) throw DomainErrors.notFound();
    return { nombre: o.nombre, pais: o.pais, idiomaDefecto: o.idioma_defecto };
  }

  async update(operadorId: string, usuarioId: string, body: unknown) {
    const { nombre, pais, idiomaDefecto } = patchSchema.parse(body);
    return this.db.transaction(async (tx) => {
      const prev = await tx.queryOne<any>(
        'select nombre, pais, idioma_defecto from operadores where id = $1',
        [operadorId],
      );
      if (!prev) throw DomainErrors.notFound();
      await tx.query(
        'update operadores set nombre = $2, pais = $3, idioma_defecto = $4, updated_at = now() where id = $1',
        [operadorId, nombre, pais.toUpperCase(), idiomaDefecto.toLowerCase()],
      );
      await tx.query(
        `insert into auditoria (actor_id, operador_id, accion, entidad, entidad_id, valor_anterior, valor_nuevo)
         values ($1, $2, 'unidad.configurar', 'operadores', $2, $3, $4)`,
        [usuarioId, operadorId, JSON.stringify(prev), JSON.stringify({ nombre, pais, idiomaDefecto })],
      );
      return { nombre, pais: pais.toUpperCase(), idiomaDefecto: idiomaDefecto.toLowerCase() };
    });
  }
}
