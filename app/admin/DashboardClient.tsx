'use client';

import { Clock, CheckCircle, XCircle, Database } from 'lucide-react';
import { categoryLabel, categoryHexColor } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────

interface StatCardsProps {
  pending: number;
  published: number;
  approvedThisMonth: number;
  rejectedThisMonth: number;
}

interface CompletenessField {
  key: string;
  label: string;
  missing: number;
}

interface CategoryCount {
  category: string;
  count: number;
}

interface AuditEntry {
  id: number;
  action: 'approve' | 'reject';
  race_name: string | null;
  race_city: string | null;
  created_at: string;
}

interface DashboardClientProps {
  stats: StatCardsProps;
  completeness: CompletenessField[];
  total: number;
  categoryCounts: CategoryCount[];
  recentActions: AuditEntry[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDatetime(iso: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ActionBadge({ action }: { action: 'approve' | 'reject' }) {
  if (action === 'approve') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
        Validée
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
      Rejetée
    </span>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  sublabel,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  sublabel?: string;
}) {
  return (
    <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon size={20} className={iconColor} />
      </div>
      <div>
        <p className="text-xs text-zinc-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-zinc-900 leading-tight">{value}</p>
        {sublabel && <p className="text-xs text-zinc-400 mt-0.5">{sublabel}</p>}
      </div>
    </div>
  );
}

function CompletenessBar({
  label,
  missing,
  total,
}: {
  label: string;
  missing: number;
  total: number;
}) {
  const filled = total - missing;
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
  const barColor =
    pct >= 90 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 text-sm text-zinc-600 truncate">{label}</span>
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`w-10 shrink-0 text-right text-xs font-semibold ${
          pct >= 90 ? 'text-green-600' : pct >= 60 ? 'text-amber-600' : 'text-red-600'
        }`}
      >
        {pct}%
      </span>
    </div>
  );
}

function DonutChart({
  categoryCounts,
  total,
}: {
  categoryCounts: CategoryCount[];
  total: number;
}) {
  // Build conic-gradient segments
  let cumulative = 0;
  const segments: { color: string; from: number; to: number; label: string; count: number }[] = [];

  for (const { category, count } of categoryCounts) {
    if (count === 0) continue;
    const pct = (count / total) * 100;
    segments.push({
      color: categoryHexColor(category),
      from: cumulative,
      to: cumulative + pct,
      label: categoryLabel(category),
      count,
    });
    cumulative += pct;
  }

  const gradientParts = segments.map(
    (s) => `${s.color} ${s.from.toFixed(1)}% ${s.to.toFixed(1)}%`
  );
  const gradient = `conic-gradient(${gradientParts.join(', ')})`;

  return (
    <div className="flex items-center gap-6">
      {/* Donut */}
      <div className="relative w-40 h-40 shrink-0">
        <div
          className="w-full h-full rounded-full"
          style={{ background: gradient }}
        />
        {/* Hole */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-white flex flex-col items-center justify-center">
            <span className="text-lg font-bold text-zinc-900 leading-tight">{total}</span>
            <span className="text-[10px] text-zinc-400">courses</span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <ul className="space-y-1.5 flex-1 min-w-0">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-sm">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: s.color }}
            />
            <span className="text-zinc-600 truncate">{s.label}</span>
            <span className="ml-auto text-zinc-900 font-semibold">{s.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function DashboardClient({
  stats,
  completeness,
  total,
  categoryCounts,
  recentActions,
}: DashboardClientProps) {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Vue d&apos;ensemble</h1>
        <p className="text-zinc-500 mt-1 text-sm">
          Statistiques globales de la plateforme TriRace.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="En attente"
          value={stats.pending}
          icon={Clock}
          iconBg="bg-amber-50"
          iconColor="text-amber-500"
          sublabel="à valider"
        />
        <StatCard
          label="Validées ce mois"
          value={stats.approvedThisMonth}
          icon={CheckCircle}
          iconBg="bg-green-50"
          iconColor="text-green-500"
          sublabel="ce mois-ci"
        />
        <StatCard
          label="Rejetées ce mois"
          value={stats.rejectedThisMonth}
          icon={XCircle}
          iconBg="bg-red-50"
          iconColor="text-red-500"
          sublabel="ce mois-ci"
        />
        <StatCard
          label="Total publié"
          value={stats.published}
          icon={Database}
          iconBg="bg-violet-50"
          iconColor="text-violet-500"
          sublabel="courses en ligne"
        />
      </div>

      {/* Completeness */}
      <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-zinc-900 mb-5">
          Complétude des données
        </h2>
        <div className="space-y-3">
          {completeness.map((field) => (
            <CompletenessBar
              key={field.key}
              label={field.label}
              missing={field.missing}
              total={total}
            />
          ))}
        </div>
      </div>

      {/* Bottom row: Donut + Recent actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donut */}
        <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-zinc-900 mb-5">
            Répartition par catégorie
          </h2>
          {total > 0 ? (
            <DonutChart categoryCounts={categoryCounts} total={total} />
          ) : (
            <p className="text-zinc-400 text-sm">Aucune donnée.</p>
          )}
        </div>

        {/* Recent actions */}
        <div className="bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-zinc-900">Dernières actions</h2>
          </div>
          {recentActions.length === 0 ? (
            <div className="px-6 py-8 text-sm text-zinc-400">
              Aucune action enregistrée.
            </div>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                {recentActions.map((entry) => (
                  <tr key={entry.id} className="hover:bg-white transition-colors">
                    <td className="px-4 py-2.5 text-zinc-400 whitespace-nowrap text-xs">
                      {formatDatetime(entry.created_at)}
                    </td>
                    <td className="px-2 py-2.5">
                      <ActionBadge action={entry.action} />
                    </td>
                    <td className="px-4 py-2.5 text-zinc-700 font-medium truncate max-w-[160px]">
                      {entry.race_name ?? <span className="text-zinc-400">—</span>}
                      {entry.race_city && (
                        <span className="text-zinc-400 font-normal ml-1 text-xs">
                          ({entry.race_city})
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
