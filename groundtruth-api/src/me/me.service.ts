import { Injectable } from '@nestjs/common';
import { DbService } from '@/db/db.service';
import { DomainErrors } from '@/common/domain-error';

/**
 * Perfil con roles DERIVADOS (Modelo-de-Datos §1): no existe columna `rol`.
 * La forma de salida es exactamente la que consume el session store del
 * frontend (groundtruth-web/src/stores/session.js).
 */
export interface Profile {
  id: string;
  nombre: string;
  email: string;
  idioma: string;
  esAdmin: boolean;
  memberships: Array<{
    operadorId: string;
    operadorNombre: string;
    subRolNombre: string;
    privileges: string[];
  }>;
  fincasPropias: string[];
}

@Injectable()
export class MeService {
  constructor(private readonly db: DbService) {}

  async getProfile(authUserId: string): Promise<Profile> {
    const usuario = await this.db.queryOne<{
      id: string;
      nombre: string;
      email: string;
      idioma: string;
      es_admin: boolean;
      activo: boolean;
    }>(
      'select id, nombre, email, idioma, es_admin, activo from usuarios where auth_user_id = $1',
      [authUserId],
    );
    if (!usuario) throw DomainErrors.userNotProvisioned();
    if (!usuario.activo) throw DomainErrors.accountInactive();

    const memberships = await this.db.query<{
      operador_id: string;
      operador_nombre: string;
      sub_rol_nombre: string;
      privileges: string[];
    }>(
      `
      select m.operador_id,
             o.nombre  as operador_nombre,
             sr.nombre as sub_rol_nombre,
             coalesce(array_agg(cp.clave) filter (where cp.clave is not null), '{}') as privileges
      from membresias m
      join operadores o  on o.id = m.operador_id
      join sub_roles sr  on sr.id = m.sub_rol_id
      left join sub_rol_privilegios srp on srp.sub_rol_id = sr.id
      -- Los privilegios DEPRECADOS se incluyen a propósito: quien ya los tiene los
      -- conserva (§A2), y PrivilegesGuard los sigue aceptando. Si los filtráramos
      -- aquí, la UI escondería acciones que el backend sí permite.
      left join catalogo_privilegios cp on cp.id = srp.privilegio_id
      -- Una unidad SUSPENDIDA desaparece del selector; una PENDIENTE_ONCHAIN no:
      -- su administración debe poder configurarla (fincas, parcelas, equipo)
      -- aunque todavía no pueda certificar por no tener tesorería.
      where m.usuario_id = $1 and m.activo and o.estado <> 'SUSPENDIDO'
      group by m.operador_id, o.nombre, sr.nombre
      order by o.nombre
      `,
      [usuario.id],
    );

    const fincas = await this.db.query<{ id: string }>(
      'select id from fincas where agricultor_id = $1',
      [usuario.id],
    );

    return {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      idioma: usuario.idioma,
      esAdmin: usuario.es_admin,
      memberships: memberships.map((m) => ({
        operadorId: m.operador_id,
        operadorNombre: m.operador_nombre,
        subRolNombre: m.sub_rol_nombre,
        privileges: m.privileges,
      })),
      fincasPropias: fincas.map((f) => f.id),
    };
  }
}
