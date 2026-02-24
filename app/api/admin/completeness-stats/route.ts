import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const baseQuery = () =>
    supabase.from('races').select('id', { count: 'exact', head: true }).eq('needs_review', false)

  const [
    { count: total },
    { count: image },
    { count: gps },
    { count: description },
    { count: price },
    { count: distances },
    { count: region },
    { count: website },
  ] = await Promise.all([
    baseQuery(),
    baseQuery().is('image_url', null),
    baseQuery().is('latitude', null),
    baseQuery().is('description', null),
    baseQuery().is('price_euros', null),
    baseQuery().is('swim_distance', null),
    baseQuery().is('region', null),
    baseQuery().is('website_url', null),
  ])

  return NextResponse.json({
    total_published: total ?? 0,
    by_field: {
      image: image ?? 0,
      gps: gps ?? 0,
      description: description ?? 0,
      price: price ?? 0,
      distances: distances ?? 0,
      region: region ?? 0,
      website: website ?? 0,
    },
  })
}
