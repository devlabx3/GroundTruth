/**
 * TelemetryChart — series de telemetría (O6) como small multiples: una
 * mini-gráfica de UNA serie esmeralda por variable. La paleta del sistema es
 * cerrada (oro reservado a certificados, lacre a error), así que no hay pareja
 * categórica: cada profundidad de temperatura tiene su propia gráfica.
 */
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { genTelemetrySeries } from '../fixtures';
import type { Telemetria } from '@/types/api';
import type { SeriePunto } from '../fixtures';

const EMERALD = '#0C3C2D';
const GRAPHITE = '#6B6F6B';
const BORDER = '#E2DED4';

const VARIABLES: { key: string; field: keyof Telemetria; unit: string; amplitude: number }[] = [
  { key: 'ph', field: 'ph', unit: '', amplitude: 0.03 },
  { key: 'ec', field: 'ec', unit: 'mS/cm', amplitude: 0.08 },
  { key: 'humidity', field: 'humedad', unit: '%', amplitude: 0.07 },
  { key: 'temp_sup', field: 'tempSup', unit: '°C', amplitude: 0.05 },
  { key: 'temp_prof', field: 'tempProf', unit: '°C', amplitude: 0.02 },
];

export default function TelemetryChart({ telemetria }: { telemetria: Telemetria }) {
  const { t } = useTranslation('dashboard');
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {VARIABLES.map(({ key, field, unit, amplitude }) => (
        <MiniChart
          key={key}
          title={t(`telemetry.${key}`)}
          unit={unit}
          data={genTelemetrySeries(telemetria[field], amplitude)}
        />
      ))}
    </div>
  );
}

function MiniChart({ title, unit, data }: { title: string; unit: string; data: SeriePunto[] }) {
  const last = data[data.length - 1]?.v;
  return (
    <div className="rounded-card border border-porcelain-border bg-white p-3">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs text-graphite">{title}</span>
        <span className="font-mono text-sm text-ink">
          {last} <span className="text-xs text-graphite">{unit}</span>
        </span>
      </div>
      <ResponsiveContainer width="100%" height={96}>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={BORDER} vertical={false} />
          <XAxis
            dataKey="t"
            interval={7}
            tick={{ fontSize: 10, fill: GRAPHITE, fontFamily: 'IBM Plex Mono' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            width={34}
            domain={['auto', 'auto']}
            tick={{ fontSize: 10, fill: GRAPHITE, fontFamily: 'IBM Plex Mono' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(v) => [`${v} ${unit}`.trim(), title]}
            contentStyle={{
              background: '#FFFFFF',
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: GRAPHITE }}
          />
          <Line
            type="monotone"
            dataKey="v"
            stroke={EMERALD}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, stroke: '#FFFFFF', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
