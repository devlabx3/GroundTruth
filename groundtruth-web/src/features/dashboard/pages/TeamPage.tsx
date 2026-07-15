import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PlusIcon, TrashIcon, WarningIcon } from '@phosphor-icons/react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Dialog from '@/components/ui/Dialog';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Input from '@/components/ui/Input';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { PRIVILEGES, SENSITIVE_PRIVILEGES } from '@/lib/privileges';
import { fetchEquipo, crearSubrol, eliminarSubrol } from '../queries';
import { errorKey } from '@/lib/api';
import AlertBanner from '@/components/shared/AlertBanner';
import type { Miembro, Privilege, SubRol } from '@/types/api';

/**
 * Equipo y sub-roles (O9). Reglas duras (Errores §5.6):
 * - La unidad nunca queda sin `equipo.gestionar` (último admin → bloqueo, backend).
 * - Un sub-rol en uso no se elimina (backend 409 → bloqueo).
 * - Asignar privilegio sensible (emitir/revocar) exige confirmación auditada.
 */
export default function TeamPage() {
  const { t } = useTranslation(['dashboard', 'common']);
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['dashboard', 'equipo'], queryFn: fetchEquipo });
  const [builderOpen, setBuilderOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [checked, setChecked] = useState<Privilege[]>([]);
  const [sensitiveConfirm, setSensitiveConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null); // clave i18n de bloqueo

  if (isLoading) return <SkeletonRows rows={4} />;
  // Consulta fallida: `data` es undefined con isLoading=false. Sin este corte la
  // vista revienta al leerlo — mejor decir que algo falló que romperse en blanco.
  if (!data) return <AlertBanner messageKey="errors:server" />;
  const members = data.miembros;
  const subroles = data.subroles;

  const memberColumns: Column<Miembro>[] = [
    { key: 'nombre', header: t('common:fields.name') },
    { key: 'email', header: t('common:fields.email') },
    { key: 'subRol', header: t('team.subrole') },
  ];

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'equipo'] });
  }

  function togglePrivilege(p: Privilege) {
    setChecked((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function saveSubrole() {
    if (checked.some((p) => SENSITIVE_PRIVILEGES.has(p)) && !sensitiveConfirm) {
      setSensitiveConfirm(true); // confirmación explícita, queda auditada
      return;
    }
    setBusy(true);
    try {
      await crearSubrol(newName, checked);
      setBuilderOpen(false);
      setSensitiveConfirm(false);
      setNewName('');
      setChecked([]);
      refresh();
    } catch (e) {
      setSensitiveConfirm(false);
      setBlockedMsg(errorKey(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteSubrole(sr: SubRol) {
    if (sr.enUso > 0) {
      setBlockedMsg('dashboard:team.subrole_in_use'); // pre-empt sin round trip
      return;
    }
    try {
      await eliminarSubrol(sr.id);
      refresh();
    } catch (e) {
      setBlockedMsg(errorKey(e));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl">{t('team.title')}</h1>

      <section>
        <h2 className="mb-2 text-sm font-medium text-ink">{t('team.members')}</h2>
        <Table columns={memberColumns} rows={members} emptyTitle={t('team.empty')} />
        <p className="mt-2 text-xs text-graphite">{t('team.applies_next_session')}</p>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink">{t('team.subroles')}</h2>
          <Button variant="secondary" onClick={() => setBuilderOpen(true)}>
            <PlusIcon size={16} />
            {t('team.new_subrole')}
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {subroles.map((sr) => (
            <Card key={sr.id}>
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-ink">{sr.nombre}</div>
                <button
                  onClick={() => deleteSubrole(sr)}
                  className="rounded-card p-1.5 text-graphite hover:bg-sealwax-100 hover:text-sealwax"
                  aria-label={t('common:actions.delete')}
                >
                  <TrashIcon size={16} />
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {sr.privileges.map((p: Privilege) => (
                  <span
                    key={p}
                    className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 font-mono text-[11px] ${
                      SENSITIVE_PRIVILEGES.has(p)
                        ? 'bg-sealwax-100 text-sealwax'
                        : 'bg-porcelain text-graphite'
                    }`}
                  >
                    {SENSITIVE_PRIVILEGES.has(p) && <WarningIcon size={11} weight="fill" />}
                    {t(`common:privileges.${p}`)}
                  </span>
                ))}
              </div>
              <div className="mt-2 font-mono text-xs text-graphite">
                {t('team.in_use', { n: sr.enUso })}
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* SubRoleBuilder: checklist del catálogo de privilegios de la plataforma */}
      <Dialog open={builderOpen} onClose={() => setBuilderOpen(false)} title={t('team.new_subrole')}>
        <div className="flex flex-col gap-4">
          <Input label={t('team.subrole_name')} value={newName} onChange={(e) => setNewName(e.target.value)} />
          <div>
            <div className="text-sm text-graphite">{t('team.privileges')}</div>
            <div className="mt-2 flex flex-col gap-1.5">
              {Object.values(PRIVILEGES).map((p) => (
                <label key={p} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked.includes(p)}
                    onChange={() => togglePrivilege(p)}
                    className="accent-emerald"
                  />
                  <span className="text-ink">{t(`common:privileges.${p}`)}</span>
                  {SENSITIVE_PRIVILEGES.has(p) && <WarningIcon size={13} weight="fill" color="#6E1423" />}
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setBuilderOpen(false)}>
              {t('common:actions.cancel')}
            </Button>
            <Button onClick={saveSubrole} disabled={!newName.trim() || checked.length === 0 || busy}>
              {busy ? t('common:loading') : t('common:actions.save')}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* SensitivePrivilegeConfirm */}
      <ConfirmDialog
        open={sensitiveConfirm}
        onClose={() => setSensitiveConfirm(false)}
        onConfirm={saveSubrole}
        title={t('team.new_subrole')}
        body={t('team.sensitive_confirm')}
        danger
      />

      {/* Bloqueos: sub-rol en uso / último admin */}
      <Dialog open={!!blockedMsg} onClose={() => setBlockedMsg(null)} title={t('team.title')}>
        <p className="text-sm text-ink">{blockedMsg && t(blockedMsg)}</p>
        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={() => setBlockedMsg(null)}>
            {t('common:actions.close')}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
