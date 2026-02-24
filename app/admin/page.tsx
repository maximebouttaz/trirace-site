import { createClient } from '@/lib/supabase-server';
import DashboardClient from './DashboardClient';

interface AuditEntry {
  id: number;
  action: 'approve' | 'reject';
  race_name: string | null;
  race_city: string | null;
  created_at: string;
}

const CATEGORIES = ['XS', 'S', 'M', 'L', '70.3', 'XL', 'Ironman'] as const;

const COMPLETENESS_FIELDS = [
  { key: 'image_url', label: 'Image' },
  { key: 'latitude', label: 'GPS' },
  { key: 'description', label: 'Description' },
  { key: 'price_euros', label: 'Prix' },
  { key: 'swim_distance', label: 'Distances' },
  { key: 'region', label: 'Région' },
  { key: 'website_url', label: 'Site web' },
  { key: 'total_elevation', label: 'Dénivelé' },
  { key: 'swim_type', label: 'Type de nage' },
] as const;

export default async function AdminOverviewPage() {
  const supabase = await createClient();

  // Start of current month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // 1. Counts: pending & published
  const [{ count: pendingCount }, { count: publishedCount }] = await Promise.all([
    supabase
      .from('races')
      .select('*', { count: 'exact', head: true })
      .eq('needs_review', true)
      .is('deleted_at', null),
    supabase
      .from('races')
      .select('*', { count: 'exact', head: true })
      .eq('needs_review', false)
      .is('deleted_at', null),
  ]);

  // 2. Audit counts this month
  const [{ count: approvedCount }, { count: rejectedCount }] = await Promise.all([
    supabase
      .from('admin_audit_log')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'approve')
      .gte('created_at', monthStart),
    supabase
      .from('admin_audit_log')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'reject')
      .gte('created_at', monthStart),
  ]);

  const total = publishedCount ?? 0;

  // 3. Completeness: count missing per field among published races
  const missingCounts = await Promise.all(
    COMPLETENESS_FIELDS.map(async ({ key }) => {
      const { count } = await supabase
        .from('races')
        .select('*', { count: 'exact', head: true })
        .eq('needs_review', false)
        .is('deleted_at', null)
        .is(key, null);
      return count ?? 0;
    })
  );

  const completeness = COMPLETENESS_FIELDS.map((field, i) => ({
    key: field.key,
    label: field.label,
    missing: missingCounts[i],
  }));

  // 4. Count per category among published races
  const categoryCounts = await Promise.all(
    CATEGORIES.map(async (category) => {
      const { count } = await supabase
        .from('races')
        .select('*', { count: 'exact', head: true })
        .eq('needs_review', false)
        .is('deleted_at', null)
        .eq('category', category);
      return { category, count: count ?? 0 };
    })
  );

  // 5. Last 10 audit actions
  const { data: recentEntries } = await supabase
    .from('admin_audit_log')
    .select('id, action, race_name, race_city, created_at')
    .order('created_at', { ascending: false })
    .limit(10)
    .returns<AuditEntry[]>();

  return (
    <DashboardClient
      stats={{
        pending: pendingCount ?? 0,
        published: total,
        approvedThisMonth: approvedCount ?? 0,
        rejectedThisMonth: rejectedCount ?? 0,
      }}
      completeness={completeness}
      total={total}
      categoryCounts={categoryCounts}
      recentActions={recentEntries ?? []}
    />
  );
}
