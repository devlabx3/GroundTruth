import { useTranslation } from 'react-i18next';
import { CheckCircleIcon, XCircleIcon } from '@phosphor-icons/react';
import type { Privilege } from '@/types/api';
import { PRIVILEGES } from '@/lib/privileges';

type PermissionsChecklistProps = {
  enabledPrivileges: Privilege[];
  allPrivileges?: Privilege[];
};

export default function PermissionsChecklist({
  enabledPrivileges,
  allPrivileges,
}: PermissionsChecklistProps) {
  const { t } = useTranslation(['common']);

  const allPrivs = allPrivileges || (Object.values(PRIVILEGES) as Privilege[]);
  const enabledSet = new Set(enabledPrivileges);

  const enabled = allPrivs.filter((p) => enabledSet.has(p));
  const disabled = allPrivs.filter((p) => !enabledSet.has(p));

  return (
    <div className="mt-2 grid gap-3 md:grid-cols-2">
      {/* Columna izquierda: Habilitados */}
      <div>
        <div className="mb-1.5 text-xs font-semibold text-emerald">Habilitados</div>
        <div className="flex flex-col gap-1.5">
          {enabled.map((p) => (
            <div key={p} className="flex items-center gap-2 text-sm">
              <CheckCircleIcon size={16} className="text-emerald" weight="fill" />
              <span className="text-ink">{t(`common:privileges.${p}`)}</span>
            </div>
          ))}
          {enabled.length === 0 && <div className="text-xs text-graphite italic">Ninguno</div>}
        </div>
      </div>

      {/* Columna derecha: Deshabilitados */}
      <div>
        <div className="mb-1.5 text-xs font-semibold text-red-500">Deshabilitados</div>
        <div className="flex flex-col gap-1.5">
          {disabled.map((p) => (
            <div key={p} className="flex items-center gap-2 text-sm">
              <XCircleIcon size={16} className="text-red-500" weight="fill" />
              <span className="text-graphite">{t(`common:privileges.${p}`)}</span>
            </div>
          ))}
          {disabled.length === 0 && <div className="text-xs text-graphite italic">Ninguno</div>}
        </div>
      </div>
    </div>
  );
}
