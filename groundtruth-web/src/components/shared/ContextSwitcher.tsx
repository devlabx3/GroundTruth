import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CaretDownIcon, SwapIcon } from '@phosphor-icons/react';
import { useSession } from '@/stores/session';
import type { ActiveContext, Profile } from '@/types/api';

/**
 * Cambio entre membresías / entre rol Operador y Agricultor (Indice-de-Vistas §2.2).
 * Visible solo si el usuario tiene más de un contexto posible.
 */
export default function ContextSwitcher() {
  const { t } = useTranslation('common');
  const { locale } = useParams();
  const navigate = useNavigate();
  const profile = useSession((s) => s.profile);
  const active = useSession((s) => s.activeContext);
  const setActiveContext = useSession((s) => s.setActiveContext);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) =>
      ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const contexts = buildContexts(profile);
  if (contexts.length <= 1) return null;

  const currentLabel =
    active?.type === 'farmer'
      ? t('context.farmer')
      : (active?.operadorNombre ?? t('context_switch'));

  function select(ctx: ActiveContext) {
    setActiveContext(ctx);
    setOpen(false);
    navigate(`/${locale}/${ctx.type === 'farmer' ? 'dapp' : 'dashboard'}`);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-card border border-porcelain-border bg-white px-2.5 py-1.5 text-xs text-ink hover:bg-porcelain"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <SwapIcon size={14} />
        {currentLabel}
        <CaretDownIcon size={12} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-1 w-56 rounded-card border border-porcelain-border bg-white py-1 shadow-sm"
        >
          {contexts.map((ctx) => {
            // Discriminar por `type` primero: es lo que hace que la unión se estreche
            // y que comparar `operadorId` sea legal (solo existe en la rama 'operator').
            const isActive =
              ctx.type === 'farmer'
                ? active?.type === 'farmer'
                : active?.type === 'operator' && active.operadorId === ctx.operadorId;
            return (
              <button
                key={ctx.type === 'farmer' ? 'farmer' : ctx.operadorId}
                role="menuitem"
                onClick={() => select(ctx)}
                className={`block w-full px-3 py-2 text-left text-xs ${
                  isActive ? 'bg-emerald-100 text-emerald' : 'text-ink hover:bg-porcelain'
                }`}
              >
                {ctx.type === 'farmer' ? t('context.farmer') : ctx.operadorNombre}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function buildContexts(profile: Profile | null): ActiveContext[] {
  if (!profile) return [];
  const contexts: ActiveContext[] = (profile.memberships ?? []).map((m) => ({
    type: 'operator',
    operadorId: m.operadorId,
    operadorNombre: m.operadorNombre,
  }));
  if ((profile.fincasPropias?.length ?? 0) > 0) contexts.push({ type: 'farmer' });
  return contexts;
}
