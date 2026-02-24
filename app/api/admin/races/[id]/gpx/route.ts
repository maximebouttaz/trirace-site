import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { parseGPX } from '@/lib/gpx-parser';

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const VALID_SEGMENTS = ['swim', 'bike', 'run'] as const;
type Segment = (typeof VALID_SEGMENTS)[number];

async function checkAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single<{ role: string }>();

  return profile?.role === 'admin' ? session : null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const session = await checkAdmin(supabase);

  if (!session) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const raceId = Number(id);
  if (!raceId || isNaN(raceId)) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  const file = formData.get('gpx') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'Fichier GPX manquant.' }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Fichier trop volumineux (max 5 Mo).' }, { status: 400 });
  }

  const segment = formData.get('segment') as string | null;
  if (!segment || !VALID_SEGMENTS.includes(segment as Segment)) {
    return NextResponse.json({ error: 'Segment invalide (swim, bike ou run requis).' }, { status: 400 });
  }

  const gpxString = await file.text();

  let parsed;
  try {
    parsed = parseGPX(gpxString);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur de parsing GPX.';
    return NextResponse.json({ error: msg }, { status: 422 });
  }

  // Read existing data to merge
  const { data: existing } = await supabase
    .from('races')
    .select('track_geojson, elevation_profile')
    .eq('id', raceId)
    .single<{ track_geojson: Record<string, unknown> | null; elevation_profile: Record<string, unknown> | null }>();

  const trackObj = (existing?.track_geojson as Record<string, unknown>) ?? {};
  const elevObj = (existing?.elevation_profile as Record<string, unknown>) ?? {};

  trackObj[segment] = parsed.trackGeoJSON;
  elevObj[segment] = parsed.elevationProfile;

  const { error } = await supabase
    .from('races')
    .update({
      track_geojson: trackObj,
      elevation_profile: elevObj,
      updated_at: new Date().toISOString(),
    })
    .eq('id', raceId);

  if (error) {
    console.error('[POST /api/admin/races/[id]/gpx]', error);
    return NextResponse.json({ error: 'Erreur lors de la sauvegarde.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    segment,
    trackPointCount: parsed.trackGeoJSON.coordinates.length,
    elevationPointCount: parsed.elevationProfile.length,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const session = await checkAdmin(supabase);

  if (!session) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const raceId = Number(id);
  if (!raceId || isNaN(raceId)) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 });
  }

  const segment = request.nextUrl.searchParams.get('segment');

  // If a specific segment is requested, remove only that segment
  if (segment && VALID_SEGMENTS.includes(segment as Segment)) {
    const { data: existing } = await supabase
      .from('races')
      .select('track_geojson, elevation_profile')
      .eq('id', raceId)
      .single<{ track_geojson: Record<string, unknown> | null; elevation_profile: Record<string, unknown> | null }>();

    const trackObj = (existing?.track_geojson as Record<string, unknown>) ?? {};
    const elevObj = (existing?.elevation_profile as Record<string, unknown>) ?? {};

    delete trackObj[segment];
    delete elevObj[segment];

    const hasAnySegment = Object.keys(trackObj).length > 0;

    const { error } = await supabase
      .from('races')
      .update({
        track_geojson: hasAnySegment ? trackObj : null,
        elevation_profile: hasAnySegment ? elevObj : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', raceId);

    if (error) {
      console.error('[DELETE /api/admin/races/[id]/gpx]', error);
      return NextResponse.json({ error: 'Erreur lors de la suppression.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, segment });
  }

  // No segment specified: delete everything
  const { error } = await supabase
    .from('races')
    .update({
      track_geojson: null,
      elevation_profile: null,
      gpx_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', raceId);

  if (error) {
    console.error('[DELETE /api/admin/races/[id]/gpx]', error);
    return NextResponse.json({ error: 'Erreur lors de la suppression.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
