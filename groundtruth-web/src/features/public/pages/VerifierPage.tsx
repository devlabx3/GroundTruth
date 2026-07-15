import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MagnifyingGlassIcon, FileArrowUpIcon, SealCheckIcon, XCircleIcon, ArrowSquareOutIcon } from '@phosphor-icons/react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import StatusBadge from '@/components/ui/StatusBadge';
import ExplorerLink from '@/components/shared/ExplorerLink';
import { api } from '@/lib/api';
import type { CertificadoPublico, EstadoCertificado } from '@/types/api';

/** Las tres formas de buscar un certificado sin tener cuenta. */
type Busqueda = 'number' | 'asset' | 'document';
type EstadoConsulta = 'idle' | 'loading' | 'found' | 'notfound';

/**
 * Verificador público (V2) — única superficie sin login.
 * Tres entradas: número GT-AAAA-NNNNN, asset ID, o subir PDF (hash en el navegador).
 * Muestra el contrato de privacidad de Modelo-de-Datos §7.1 (nunca agricultor ni polígono).
 */
export default function VerifierPage() {
  const { t } = useTranslation(['verify', 'common']);
  // El QR impreso en el PDF apunta a /:locale/verificar/:certId. Sin esto, escanear
  // el QR abría el formulario vacío — y ese QR es el punto entero del verificador.
  const { certId } = useParams();
  const [tab, setTab] = useState<Busqueda>('number');
  const [query, setQuery] = useState(certId ?? '');
  const [result, setResult] = useState<CertificadoPublico | null>(null);
  // Si venimos del QR, la vista NACE cargando: no hay parpadeo de formulario vacío.
  const [status, setStatus] = useState<EstadoConsulta>(certId ? 'loading' : 'idle');
  const [docCheck, setDocCheck] = useState<'match' | 'mismatch' | null>(null);

  const buscar = useCallback(async (q: string, by: Busqueda) => {
    if (!q) return;
    setStatus('loading');
    setDocCheck(null);
    try {
      // Consulta la vista pública restringida vía backend (rate-limited).
      const { data } = await api.get<CertificadoPublico>('/public/certificates', {
        params: { q, by },
      });
      setResult(data);
      setStatus('found');
    } catch {
      setStatus('notfound');
      setResult(null);
    }
  }, []);

  // Deep link del QR impreso en el PDF. El estado se escribe DESPUÉS del await
  // (no en el cuerpo del efecto) y se cancela si el componente se desmonta.
  useEffect(() => {
    if (!certId) return undefined;
    let cancelado = false;
    (async () => {
      try {
        const { data } = await api.get<CertificadoPublico>('/public/certificates', {
          params: { q: certId, by: 'number' },
        });
        if (!cancelado) {
          setResult(data);
          setStatus('found');
        }
      } catch {
        if (!cancelado) setStatus('notfound');
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [certId]);

  const search = () => buscar(query, tab);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setStatus('loading');
    // Hash del PDF calculado localmente: el documento nunca sale del navegador.
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buf);
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    try {
      const { data } = await api.get<CertificadoPublico>('/public/certificates', {
        params: { q: hex, by: 'hash' },
      });
      setResult(data);
      setDocCheck(data.hashPdf === hex ? 'match' : 'mismatch');
      setStatus('found');
    } catch {
      setStatus('notfound');
      setResult(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl">{t('title')}</h1>
      <p className="mt-3 text-graphite">{t('subtitle')}</p>

      <Card className="mt-8">
        <div className="flex gap-1 rounded-card bg-porcelain p-1">
          {(['number', 'asset', 'document'] as const).map((k) => (
            <button
              key={k}
              onClick={() => { setTab(k); setResult(null); setStatus('idle'); }}
              className={`flex-1 rounded-[8px] px-3 py-2 text-sm ${tab === k ? 'bg-white text-ink shadow-sm' : 'text-graphite'}`}
            >
              {t(`tabs.${k}`)}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {tab === 'document' ? (
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-card border border-dashed border-porcelain-border py-10 text-center text-sm text-graphite">
              <FileArrowUpIcon size={28} />
              {t('input.drop')}
              <input type="file" accept="application/pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
          ) : (
            <div className="flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t(tab === 'number' ? 'input.number_placeholder' : 'input.asset_placeholder')}
                className="flex-1 rounded-card border border-porcelain-border px-3 py-2 font-mono text-sm"
              />
              <Button onClick={search}><MagnifyingGlassIcon size={16} />{t('input.search')}</Button>
            </div>
          )}
        </div>
      </Card>

      {status === 'notfound' && (
        <p className="mt-4 text-sm text-sealwax">{t('cert_not_found', { ns: 'errors' })}</p>
      )}

      {status === 'found' && result && (
        <Card className="mt-6">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm text-graphite">{result.numeroPublico}</span>
            <StatusBadge status={statusToBadge(result.estado)} />
          </div>

          {docCheck && (
            <div className={`mt-4 flex items-center gap-2 rounded-card px-3 py-2 text-sm ${docCheck === 'match' ? 'bg-emerald-100 text-emerald' : 'bg-sealwax-100 text-sealwax'}`}>
              {docCheck === 'match' ? <SealCheckIcon size={18} weight="fill" /> : <XCircleIcon size={18} weight="fill" />}
              {t(docCheck === 'match' ? 'result.doc_match' : 'result.doc_mismatch')}
            </div>
          )}

          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <Field label={t('result.crop')} value={result.cultivo} />
            <Field label={t('result.region')} value={result.pais} />
            <Field label={t('result.issued_on')} value={fecha(result.emitidoEn)} />
            <Field label={t('result.valid_until')} value={fecha(result.vigenteHasta)} />
            <Field label={t('result.hash_pdf')} value={result.hashPdf} mono />
            <Field label={t('result.hash_image')} value={result.hashImagen} mono />
          </dl>

          {/* La verificación INDEPENDIENTE: quien recibe el documento comprueba el
              certificado contra la cadena y Arweave sin fiarse de esta página. */}
          {(result.assetId || result.uriGeojson) && (
            <div className="mt-4 flex flex-col gap-2 border-t border-porcelain-border pt-4">
              {result.assetId && (
                <ExplorerLink type="address" value={result.assetId} />
              )}
              {result.uriGeojson && (
                <a
                  href={arweaveUrl(result.uriGeojson)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-emerald underline-offset-2 hover:underline"
                >
                  <ArrowSquareOutIcon size={14} />
                  {t('result.geojson')}
                  <span className="truncate font-mono text-graphite">{result.uriGeojson}</span>
                </a>
              )}
            </div>
          )}

          {result.estado === 'REVOKED' && (
            <p className="mt-4 rounded-card bg-sealwax-100 px-3 py-2 text-sm text-sealwax">
              {t('result.revoked_notice', { fecha: fecha(result.revocadoEn) })}
            </p>
          )}

          <p className="mt-4 text-xs text-graphite">{t('privacy_note')}</p>
        </Card>
      )}
    </div>
  );
}

/** `ar://<id>` → una URL que un navegador puede abrir. */
function arweaveUrl(uri: string) {
  const id = uri.replace(/^ar:\/\//, '');
  return `https://gateway.irys.xyz/${id}`;
}

function fecha(iso: string | null | undefined) {
  return iso ? new Date(iso).toISOString().slice(0, 10) : null;
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-graphite">{label}</dt>
      <dd className={`text-ink ${mono ? 'truncate font-mono text-xs' : ''}`}>{value ?? '—'}</dd>
    </div>
  );
}

function statusToBadge(estado: EstadoCertificado) {
  // `DRAFT` no aparece: la vista `certificados_publicos` los excluye, así que un
  // certificado en borrador nunca llega hasta aquí. Por eso el mapa es parcial.
  const badges: Partial<Record<EstadoCertificado, string>> = {
    ACTIVE: 'vigente',
    SUPERSEDED: 'sustituido',
    EXPIRED: 'expirado',
    REVOKED: 'revocado',
  };
  return badges[estado] ?? 'pendiente';
}
