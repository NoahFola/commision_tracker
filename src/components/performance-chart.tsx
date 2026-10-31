'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatAmountOnly } from '@/lib/money/format';

export type PerformanceChartPoint = {
  periodKey: string;
  value: number;
  currency?: string;
};

/**
 * Bar chart for the Performance tab. Loaded dynamically so Recharts
 * does not ship in the initial bundle of any screen other than the
 * Performance tab.
 *
 * Recharts is SVG-based; it does not read CSS variables through to
 * SVG attributes reliably, so the bar color is passed as a hex string.
 * Keep it in sync with --btn-primary-bg in globals.css.
 */
const BAR_COLOUR = '#15803d';

export default function PerformanceChart({
  data,
  format,
}: {
  data: PerformanceChartPoint[];
  format: 'money' | 'count';
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-text-secondary">
        No data in the selected range.
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
          <XAxis
            dataKey="periodKey"
            tick={{ fontSize: 12, fill: '#525252' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#525252' }}
            axisLine={false}
            tickLine={false}
            width={60}
            tickFormatter={(v: number) =>
              format === 'money' ? formatAmountOnly({ amount: v, currency: 'XAF' }) : String(v)
            }
          />
          <Tooltip
            formatter={(v) =>
              typeof v === 'number'
                ? format === 'money'
                  ? `${formatAmountOnly({ amount: v, currency: 'XAF' })} XAF`
                  : String(v)
                : String(v)
            }
            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
          />
          <Bar dataKey="value" fill={BAR_COLOUR} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}