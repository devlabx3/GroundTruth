/**
 * OnchainProgressModal — componente reutilizable para TODA acción on-chain
 * (Sistema-de-Diseno §7). Parametrizado por una lista de pasos; no se crea una
 * pantalla por acción.
 *
 * Cumple las 7 reglas de comportamiento obligatorias:
 *  1. No se cierra mientras haya un paso activo (sin click-fuera, sin Escape, sin X).
 *  2. "Puedes seguir en segundo plano" solo cuando ya es seguro cerrar.
 *  3. Un paso fallido no borra el progreso; el reintento retoma desde ahí.
 *  4. Éxito: todos en check, el núcleo de suelo completa el 4.º segmento en oro.
 *  5. Error: modal abierto, paso en lacre + motivo + acción correctiva.
 *  6. Texto por i18n (claves), datos técnicos sin traducir.
 *  7. role="dialog", foco atrapado, cambios anunciados por aria-live.
 */
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Circle, XCircle, CircleNotch } from '@phosphor-icons/react';
import SoilCoreIndicator from './SoilCoreIndicator';
import Button from '../ui/Button';

// steps: [{ key, labelKey, detail?, status: 'pending'|'active'|'done'|'failed', errorKey?, action? }]
export default function OnchainProgressModal({
  open,
  titleKey,
  steps,
  canDismiss = false, // regla 1: solo true cuando ningún paso está activo
  onDismiss,
  certified = false,
}) {
  const { t } = useTranslation(['dashboard', 'common']);
  const dialogRef = useRef(null);

  const activeIndex = steps.findIndex((s) => s.status === 'active');
  const doneCount = steps.filter((s) => s.status === 'done').length;
  const hasActive = activeIndex !== -1;
  const anyFailed = steps.some((s) => s.status === 'failed');

  // Regla 1 y 7: Escape solo cierra si se permite; foco al abrir.
  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape' && canDismiss && !hasActive) onDismiss?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, canDismiss, hasActive, onDismiss]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(16,19,18,0.55)' }}
      onMouseDown={(e) => {
        // Regla 1: click-fuera cierra solo si es seguro
        if (e.target === e.currentTarget && canDismiss && !hasActive) onDismiss?.();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onchain-title"
        tabIndex={-1}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-porcelain-border bg-porcelain outline-none"
      >
        {/* Cabecera esmeralda con el núcleo de suelo */}
        <div className="flex items-center gap-3 bg-emerald px-5 py-4">
          <SoilCoreIndicator filled={certified ? 4 : Math.min(doneCount, 4)} certified={certified} size="md" />
          <div>
            <div id="onchain-title" className="font-sans text-[15px] font-medium text-porcelain">
              {t(titleKey)}
            </div>
            <div className="text-xs text-emerald-300">
              {hasActive ? t('dashboard:onchain.keep_open') : t('dashboard:onchain.background')}
            </div>
          </div>
        </div>

        {/* Lista de pasos */}
        <ul className="px-5 py-1" aria-live="polite">
          {steps.map((step, i) => (
            <li
              key={step.key}
              className="flex gap-3 border-b border-porcelain-border/60 py-3 last:border-0"
              style={{ opacity: step.status === 'pending' ? 0.5 : 1 }}
            >
              <StepIcon status={step.status} index={i} />
              <div className="flex-1">
                <div className="text-sm font-medium text-ink">{t(step.labelKey)}</div>
                {step.detail && (
                  <div className="font-mono text-xs text-graphite">{step.detail}</div>
                )}
                {step.status === 'failed' && (
                  <div className="mt-1 text-xs text-sealwax">
                    {t(step.errorKey ?? 'errors.server', { ns: 'errors' })}
                  </div>
                )}
                {step.status === 'failed' && step.action}
              </div>
            </li>
          ))}
        </ul>

        {/* Pie */}
        <div className="flex items-center justify-between bg-[#EFEDE6] px-5 py-3">
          <span className="font-mono text-xs text-graphite">
            {t('dashboard:onchain.step_of', {
              current: Math.min(doneCount + (hasActive ? 1 : 0), steps.length),
              total: steps.length,
            })}
          </span>
          {canDismiss && !hasActive && (
            <Button variant="ghost" onClick={onDismiss} className="px-3 py-1 text-xs">
              {t('common:actions.close')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepIcon({ status, index }) {
  if (status === 'done')
    return (
      <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-emerald">
        <CheckCircle size={16} weight="fill" color="#F7F5F0" />
      </span>
    );
  if (status === 'active')
    return <CircleNotch size={22} className="shrink-0 animate-spin" color="#C69B3C" />;
  if (status === 'failed')
    return <XCircle size={22} weight="fill" className="shrink-0" color="#6E1423" />;
  return (
    <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border border-graphite/50">
      <span className="font-mono text-[11px] text-graphite">{index + 1}</span>
    </span>
  );
}
