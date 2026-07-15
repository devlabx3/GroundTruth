import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import StatusBadge from '@/components/ui/StatusBadge';
import { SkeletonRows } from '@/components/ui/Skeleton';
import AlertBanner from '@/components/shared/AlertBanner';
import SoilCoreIndicator from '@/components/shared/SoilCoreIndicator';
import CostPreviewCard from '../components/CostPreviewCard';
import { fetchParcelas, createEmbarque } from '../queries';

/**
 * Preparar embarque (O7). Reglas de dominio en la selección:
 * - Unicidad de cultivo: parcelas mezcladas bloquean el avance (D-regla, Errores §5.4).
 * - Una parcela en rojo (alerta) no puede certificarse → no es seleccionable.
 */
export default function ShipmentNewPage() {
  const { t } = useTranslation(['dashboard', 'common']);
  const { locale } = useParams();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const { data: parcels, isLoading } = useQuery({
    queryKey: ['dashboard', 'parcels'],
    queryFn: fetchParcelas,
  });

  if (isLoading) return <SkeletonRows rows={5} />;
  // Consulta fallida: `data` es undefined con isLoading=false. Sin este corte la
  // vista revienta al leerlo — mejor decir que algo falló que romperse en blanco.
  if (!parcels) return <AlertBanner messageKey="errors:server" />;

  const selectedParcels = parcels.filter((p) => selected.includes(p.id));
  const crops = [...new Set(selectedParcels.map((p) => p.cultivo))];
  const cropMismatch = crops.length > 1;

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function createDraft() {
    setCreating(true);
    try {
      const { id } = await createEmbarque(selected);
      navigate(`/${locale}/dashboard/embarques/${id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl">{t('shipments.new')}</h1>

      <Card>
        <div className="mb-3 text-xs text-graphite">{t('shipments.select_parcels')}</div>
        <div className="flex flex-col gap-2">
          {parcels.map((p) => {
            const blocked = p.estado === 'alerta';
            return (
              <label
                key={p.id}
                className={`flex items-center gap-3 rounded-card border px-3 py-2 ${
                  blocked
                    ? 'cursor-not-allowed border-porcelain-border opacity-60'
                    : 'cursor-pointer border-porcelain-border hover:border-emerald'
                } ${selected.includes(p.id) ? 'border-emerald bg-emerald-100/40' : ''}`}
              >
                <input
                  type="checkbox"
                  disabled={blocked}
                  checked={selected.includes(p.id)}
                  onChange={() => toggle(p.id)}
                  className="accent-emerald"
                />
                <SoilCoreIndicator filled={p.filled} certified={p.certificada} size="sm" />
                <div className="flex-1">
                  <div className="text-sm text-ink">{p.nombre}</div>
                  <div className="font-mono text-xs text-graphite">{t(`common:crops.${p.cultivo}`)}</div>
                  {blocked && <div className="mt-0.5 text-xs text-sealwax">{t('shipments.parcel_red')}</div>}
                </div>
                <StatusBadge status={p.estado} />
              </label>
            );
          })}
        </div>
      </Card>

      {cropMismatch && <AlertBanner messageKey="dashboard:shipments.crop_mismatch" />}

      {selectedParcels.length > 0 && !cropMismatch && <CostPreviewCard parcels={selectedParcels} />}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => navigate(`/${locale}/dashboard/embarques`)}>
          {t('common:actions.cancel')}
        </Button>
        <Button disabled={selectedParcels.length === 0 || cropMismatch || creating} onClick={createDraft}>
          {creating ? t('common:loading') : t('common:actions.continue')}
        </Button>
      </div>
    </div>
  );
}
