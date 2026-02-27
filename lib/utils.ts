import type { Race } from './types';

export function formatDistance(meters: number | null): string {
  if (!meters) return '—';
  if (meters >= 1000) return `${(meters / 1000).toFixed(meters % 1000 === 0 ? 0 : 1)}km`;
  return `${meters}m`;
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Date TBC';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatDateLong(dateStr: string | null): string {
  if (!dateStr) return 'Date TBC';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    'XS': 'XS', 'S': 'Sprint', 'M': 'Olympique',
    'L': 'Longue Distance', '70.3': '70.3',
    'XL': 'XL', 'Ironman': 'Ironman',
  };
  return map[cat] || cat;
}

export function categoryColor(cat: string): string {
  switch (cat) {
    case 'Ironman': return 'bg-red-600 text-white';
    case 'XL': return 'bg-purple-600 text-white';
    case '70.3': return 'bg-blue-600 text-white';
    case 'L': return 'bg-indigo-600 text-white';
    case 'M': return 'bg-emerald-600 text-white';
    case 'S': return 'bg-amber-600 text-white';
    case 'XS': return 'bg-zinc-600 text-white';
    default: return 'bg-zinc-600 text-white';
  }
}

export function formatElevation(meters: number | null): string {
  if (!meters) return '—';
  return `${meters}m D+`;
}

export function categoryHexColor(cat: string): string {
  switch (cat) {
    case 'Ironman': return '#dc2626';
    case 'XL': return '#9333ea';
    case '70.3': return '#2563eb';
    case 'L': return '#4f46e5';
    case 'M': return '#059669';
    case 'S': return '#d97706';
    case 'XS': return '#52525b';
    default: return '#52525b';
  }
}

export function categoryDotColor(cat: string): string {
  switch (cat) {
    case 'Ironman': return 'bg-red-500';
    case 'XL': return 'bg-purple-500';
    case '70.3': return 'bg-blue-500';
    case 'L': return 'bg-indigo-500';
    case 'M': return 'bg-emerald-500';
    case 'S': return 'bg-amber-500';
    case 'XS': return 'bg-zinc-500';
    default: return 'bg-zinc-500';
  }
}

export function tempLabel(temp: number | null): { label: string; color: string } {
  if (!temp) return { label: '', color: '' };
  if (temp >= 28) return { label: 'Chaud', color: 'bg-red-50 text-red-600' };
  if (temp >= 22) return { label: 'Agréable', color: 'bg-amber-50 text-amber-600' };
  if (temp >= 16) return { label: 'Frais', color: 'bg-blue-50 text-blue-600' };
  return { label: 'Froid', color: 'bg-cyan-50 text-cyan-600' };
}

export function isLongDistance(category: string): boolean {
  return ['70.3', 'L', 'XL', 'Ironman'].includes(category);
}

export function difficultyLabel(race: { total_elevation?: number | null; avg_temp_high_celsius?: number | null }): { label: string; color: string } | null {
  const elev = race.total_elevation;
  const temp = race.avg_temp_high_celsius;
  if (elev == null) return null;
  if (elev > 2500 || (temp != null && temp >= 35)) return { label: 'Extrême', color: 'bg-red-50 text-red-600' };
  if (elev >= 1500) return { label: 'Difficile', color: 'bg-orange-50 text-orange-600' };
  if (elev >= 500) return { label: 'Exigeant', color: 'bg-amber-50 text-amber-600' };
  return { label: 'Facile', color: 'bg-emerald-50 text-emerald-600' };
}

export function priceCategory(price: number | null, category: string): { label: string; color: string } | null {
  if (price == null) return null;
  const avgMap: Record<string, number> = { XS: 50, S: 80, M: 100, '70.3': 250, L: 250, XL: 400, Ironman: 400 };
  const avg = avgMap[category];
  if (!avg) return null;
  const ratio = price / avg;
  if (ratio < 0.8) return { label: 'Bon prix', color: 'bg-emerald-50 text-emerald-600' };
  if (ratio > 1.3) return { label: 'Premium', color: 'bg-purple-50 text-purple-600' };
  return null;
}

export function idealPourTags(race: Race): string[] {
  const tags: string[] = [];
  if (race.qualification_for) tags.push('Qualificatif WC');
  if (race.total_elevation == null || race.total_elevation < 500) tags.push('Parcours plat');
  if (race.total_elevation != null && race.total_elevation > 2000) tags.push('Montagneux');
  if (race.avg_temp_high_celsius != null && race.avg_temp_high_celsius >= 28) tags.push('Destination soleil');
  if (race.swim_type === 'mer' || race.swim_type === 'open water') tags.push('Open water');
  if (race.time_limit_hours != null && race.time_limit_hours >= 16 && ['XL', 'Ironman'].includes(race.category)) tags.push('Premier Ironman');
  if (race.time_limit_hours != null && race.time_limit_hours >= 8 && ['70.3', 'L'].includes(race.category)) tags.push('Premier Half');
  return tags.slice(0, 4);
}

export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  const diff = target.getTime() - today.getTime();
  if (diff <= 0) return null;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function registrationUrgency(deadline: string | null): { text: string; urgent: boolean } | null {
  const days = daysUntil(deadline);
  if (days == null) return null;
  return { text: `J-${days}`, urgent: days < 14 };
}
