import { createClient } from '@/lib/supabase-server'
import AdminMapClient from './AdminMapClient'

interface RaceWithoutGPS {
  id: number
  name: string
  city: string
  country: string
  slug: string
}

interface RaceWithGPS {
  id: number
  slug: string
  name: string
  latitude: number
  longitude: number
}

export default async function AdminMapPage() {
  const supabase = await createClient()

  const [withoutRes, withRes] = await Promise.all([
    supabase
      .from('races')
      .select('id, slug, name, city, country')
      .is('latitude', null)
      .eq('needs_review', false)
      .order('name', { ascending: true }),
    supabase
      .from('races')
      .select('id, slug, name, latitude, longitude')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .eq('needs_review', false),
  ])

  const racesWithoutGPS: RaceWithoutGPS[] = (withoutRes.data ?? []) as RaceWithoutGPS[]
  const racesWithGPS: RaceWithGPS[] = (withRes.data ?? []) as RaceWithGPS[]

  return (
    <AdminMapClient
      racesWithoutGPS={racesWithoutGPS}
      racesWithGPS={racesWithGPS}
    />
  )
}
