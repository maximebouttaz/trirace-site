'use client';

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Mountain, TrendingUp, TrendingDown } from 'lucide-react';

interface ElevationPoint {
  distance: number;
  elevation: number;
}

interface ElevationProfileProps {
  data: ElevationPoint[];
  accentColor?: string;
}

export default function ElevationProfile({ data, accentColor = '#dc2626' }: ElevationProfileProps) {
  const stats = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    let dPlus = 0;

    for (let i = 0; i < data.length; i++) {
      const ele = data[i].elevation;
      if (ele < min) min = ele;
      if (ele > max) max = ele;
      if (i > 0) {
        const diff = ele - data[i - 1].elevation;
        if (diff > 0) dPlus += diff;
      }
    }

    return { min, max, dPlus: Math.round(dPlus) };
  }, [data]);

  // Convert distance to km for chart display
  const chartData = useMemo(
    () =>
      data.map((pt) => ({
        distance: Math.round(pt.distance / 100) / 10, // km with 1 decimal
        elevation: pt.elevation,
      })),
    [data],
  );

  return (
    <div>
      {/* Stats bar */}
      <div className="flex items-center gap-4 mb-4 text-xs">
        <div className="flex items-center gap-1.5 bg-white border border-gray-100 rounded-xl px-3 py-2">
          <TrendingDown size={13} className="text-blue-500" />
          <span className="text-zinc-400 font-medium">Min</span>
          <span className="font-mono font-bold text-zinc-700">{stats.min}m</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white border border-gray-100 rounded-xl px-3 py-2">
          <TrendingUp size={13} className="text-red-500" />
          <span className="text-zinc-400 font-medium">Max</span>
          <span className="font-mono font-bold text-zinc-700">{stats.max}m</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white border border-gray-100 rounded-xl px-3 py-2">
          <Mountain size={13} className="text-purple-500" />
          <span className="text-zinc-400 font-medium">D+</span>
          <span className="font-mono font-bold text-zinc-700">{stats.dPlus}m</span>
        </div>
      </div>

      {/* Chart */}
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`elevGrad-${accentColor.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accentColor} stopOpacity={0.3} />
                <stop offset="100%" stopColor={accentColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="distance"
              tickFormatter={(v) => `${v}km`}
              tick={{ fontSize: 11, fill: '#a1a1aa' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => `${v}m`}
              tick={{ fontSize: 11, fill: '#a1a1aa' }}
              axisLine={false}
              tickLine={false}
              width={48}
              domain={['dataMin - 20', 'dataMax + 20']}
            />
            <Tooltip
              contentStyle={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                fontSize: '12px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.06)',
              }}
              formatter={(value) => [`${value}m`, 'Altitude']}
              labelFormatter={(v) => `${v} km`}
            />
            <Area
              type="monotone"
              dataKey="elevation"
              stroke={accentColor}
              strokeWidth={2}
              fill={`url(#elevGrad-${accentColor.replace('#', '')})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
