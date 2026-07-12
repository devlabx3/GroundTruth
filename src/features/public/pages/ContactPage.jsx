import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

export default function ContactPage() {
  const { t } = useTranslation('public');
  const [sent, setSent] = useState(false);
  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-3xl">{t('contact.title')}</h1>
      {sent ? (
        <Card className="mt-8 bg-emerald-100 text-emerald">{t('contact.success')}</Card>
      ) : (
        <Card className="mt-8 flex flex-col gap-4">
          {['name', 'email', 'org'].map((f) => (
            <label key={f} className="text-sm">
              <span className="text-graphite">{t(`contact.${f}`)}</span>
              <input className="mt-1 w-full rounded-card border border-porcelain-border px-3 py-2" />
            </label>
          ))}
          <label className="text-sm">
            <span className="text-graphite">{t('contact.message')}</span>
            <textarea rows={3} className="mt-1 w-full rounded-card border border-porcelain-border px-3 py-2" />
          </label>
          <Button onClick={() => setSent(true)}>{t('contact.submit')}</Button>
        </Card>
      )}
    </div>
  );
}
