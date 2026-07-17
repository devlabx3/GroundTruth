import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import AlertBanner from '@/components/shared/AlertBanner';
import { getSupabase } from '@/lib/supabase';

const API_BASE = getSupabase() ? 'https://api.groundtruth.local' : 'http://localhost:3000';

export default function ContactPage() {
  const { t } = useTranslation('public');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorKey(null);
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/public/contacto`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nombre, email, mensaje }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        if (response.status === 429) {
          setErrorKey('errors:rate_limited');
        } else {
          setErrorKey('errors:error');
        }
        setLoading(false);
        return;
      }

      setSent(true);
    } catch {
      setErrorKey('errors:error');
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-3xl">{t('contact.title')}</h1>
      {sent ? (
        <div className="mt-8">
          <AlertBanner tone="info" messageKey="public:contact.success" />
        </div>
      ) : (
        <Card className="mt-8 flex flex-col gap-4">
          {errorKey && <AlertBanner messageKey={errorKey} />}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="text-sm">
              <span className="text-graphite">{t('contact.name')}</span>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                maxLength={200}
                className="mt-1 w-full rounded-card border border-porcelain-border px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="text-graphite">{t('contact.email')}</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 w-full rounded-card border border-porcelain-border px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="text-graphite">{t('contact.message')}</span>
              <textarea
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                required
                maxLength={5000}
                rows={4}
                className="mt-1 w-full rounded-card border border-porcelain-border px-3 py-2"
              />
            </label>
            <Button type="submit" disabled={loading || !nombre.trim() || !email.trim() || !mensaje.trim()}>
              {loading ? t('contact.submitting') : t('contact.submit')}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
