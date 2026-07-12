import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import SoilCoreIndicator from '@/components/shared/SoilCoreIndicator';

export default function LandingPage() {
  const { t } = useTranslation(['public', 'common']);
  const { locale } = useParams();

  return (
    <>
      {/* Hero: la tesis de la marca — prueba física del terreno */}
      <section className="border-b border-porcelain-border bg-emerald">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <p className="eyebrow text-emerald-300">{t('hero.eyebrow')}</p>
          <h1 className="mt-4 max-w-4xl font-display text-5xl leading-[1.1] text-porcelain">
            {t('hero.title')}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-emerald-300">
            {t('hero.subtitle')}
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link to={`/${locale}/contacto`}>
              <Button variant="primary" className="bg-porcelain text-emerald hover:bg-white">
                {t('hero.cta_primary')}
              </Button>
            </Link>
            <Link to={`/${locale}/verificar`}>
              <Button variant="ghost" className="text-porcelain hover:bg-white/10">
                {t('hero.cta_secondary')}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Cómo funciona: secuencia real (numeración justificada) con el núcleo de suelo */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="eyebrow">{t('how.eyebrow')}</p>
        <h2 className="mt-3 max-w-2xl text-3xl">{t('how.title')}</h2>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          <HowStep n={1} filled={1} title={t('how.step_chemical')} desc={t('how.step_chemical_desc')} />
          <HowStep n={2} filled={2} title={t('how.step_satellite')} desc={t('how.step_satellite_desc')} />
          <HowStep n={3} filled={4} certified title={t('how.step_certificate')} desc={t('how.step_certificate_desc')} />
        </div>
      </section>

      {/* Valor */}
      <section className="border-t border-porcelain-border bg-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="eyebrow">{t('value.eyebrow')}</p>
          <h2 className="mt-3 max-w-2xl text-3xl">{t('value.title')}</h2>
          <ul className="mt-10 grid gap-6 md:grid-cols-3">
            {['point_traceable', 'point_hybrid', 'point_eudr'].map((k) => (
              <li key={k} className="border-l-2 border-emerald pl-4 text-ink">
                {t(`value.${k}`)}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

function HowStep({ n, filled, certified = false, title, desc }) {
  return (
    <div className="flex gap-4">
      <SoilCoreIndicator filled={filled} certified={certified} size="lg" />
      <div>
        <div className="font-mono text-xs text-graphite">0{n}</div>
        <h3 className="mt-1 text-xl">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-graphite">{desc}</p>
      </div>
    </div>
  );
}
