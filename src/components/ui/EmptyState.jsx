/** Estado vacío: invitación a la acción, no disculpa (Gestion-de-Errores §1). */
export default function EmptyState({ icon = null, title, action = null }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-porcelain-border py-12 text-center">
      {icon && <div className="h-12 w-12 opacity-70">{icon}</div>}
      <p className="max-w-prose text-sm text-graphite">{title}</p>
      {action}
    </div>
  );
}
