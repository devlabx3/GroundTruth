import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MagnifyingGlass, FileArrowUp, SealCheck, XCircle } from '@phosphor-icons/react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import StatusBadge from '@/components/ui/StatusBadge';
import { api } from '@/lib/api';

/**
 * Verificador público (V2) — única superficie sin login.
 * Tres entradas: número GT-AAAA-NNNNN, asset ID, o subir PDF (hash en el navegador).
 * Muestra el contrato de privacidad de Modelo-de-Datos §7.1 (nunca agricultor ni polígono).
 */
export default function VerifierPage() {
  const { t } = useTranslation(['verify', 'common']);
  const [tab, setTab] = useState('number');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('idle'); // idle|loading|found|notfound|error
  const [docCheck, setDocCheck] = useState(null); // null|'match'|'mismatch'

  async function search() {
    setStatus('loading');
    setDocCheck(null);
    try {
      // Consulta la vista pública restringida vía backend (rate-limited).
      const { data } = await api.get('/public/certificates', { params: { q: query, by: tab } });
      setResult(data);
      setStatus('found');
    } catch {
      setStatus('notfound');
      setResult(null);
    }
  }

  async function onFile(file) {
    if (!file) return;
    setStatus('loading');
    // Hash del PDF calculado localmente: el documento nunca sale del navegador.
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buf);
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    try {
      const { data } = await api.get('/public/certificates', { params: { q: hex, by: 'hash' } });
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
          {['number', 'asset', 'document'].map((k) => (
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
              <FileArrowUp size={28} />
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
              <Button onClick={search}><MagnifyingGlass size={16} />{t('input.search')}</Button>
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
              {docCheck === 'match' ? <SealCheck size={18} weight="fill" /> : <XCircle size={18} weight="fill" />}
              {t(docCheck === 'match' ? 'result.doc_match' : 'result.doc_mismatch')}
            </div>
          )}

          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <Field label={t('result.crop')} value={result.cultivo} />
            <Field label={t('result.region')} value={result.pais} />
            <Field label={t('result.valid_until')} value={result.vigenteHasta} />
            <Field label={t('result.hash_pdf')} value={result.hashPdf} mono />
          </dl>

          {result.estado === 'REVOKED' && (
            <p className="mt-4 rounded-card bg-sealwax-100 px-3 py-2 text-sm text-sealwax">
              {t('result.revoked_notice', { fecha: result.revocadoEn })}
            </p>
          )}

          <p className="mt-4 text-xs text-graphite">{t('privacy_note')}</p>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value, mono = false }) {
  return (
    <div>
      <dt className="text-xs text-graphite">{label}</dt>
      <dd className={`text-ink ${mono ? 'truncate font-mono text-xs' : ''}`}>{value ?? '—'}</dd>
    </div>
  );
}

function statusToBadge(estado) {
  return {
    ACTIVE: 'vigente', SUPERSEDED: 'sustituido', EXPIRED: 'expirado', REVOKED: 'revocado',
  }[estado] ?? 'pendiente';
}
