import Card from '@/components/ui/Card';
/** Vista con estructura lista; la lógica se implementa por iteración. */
export default function PlaceholderPage({ title, note }) {
  return (
    <div>
      <h1 className="mb-4 text-2xl">{title}</h1>
      <Card className="text-sm text-graphite">{note ?? 'Vista pendiente de implementación.'}</Card>
    </div>
  );
}
