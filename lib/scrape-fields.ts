export interface ScrapedFields {
  name: string | null
  date: string | null
  description: string | null
  image_url: string | null
  city: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
  price_euros: number | null
  website_url: string | null
  organizer_name: string | null
  swim_distance: number | null
  bike_distance: number | null
  run_distance: number | null
  category: string | null
  region: string | null
  department: string | null
  bike_elevation: number | null
  run_elevation: number | null
  max_participants: number | null
  time_limit_hours: number | null
  registration_url: string | null
  finishers_url: string | null
  tagline: string | null
  source: string | null

  // Barrières horaires (en minutes)
  swim_cutoff_minutes: number | null
  bike_cutoff_minutes: number | null
  run_cutoff_minutes: number | null
  run_laps: number | null

  // Spécificités épreuves
  swim_type: 'lac' | 'mer' | 'rivière' | 'piscine' | 'étang' | 'open water' | null
  bike_type: 'route' | 'gravel' | 'mixte' | 'vtt' | null
  is_wetsuit_allowed: boolean | null
  is_draft_legal: boolean | null

  // Inscription
  registration_deadline: string | null   // format YYYY-MM-DD

  // Records
  record_men: string | null     // format "7h42:15"
  record_women: string | null

  // Qualification
  qualification_for: string | null   // ex: "Championnats du Monde IRONMAN"

  // Contenu
  tags: string[] | null
  finishers_count: number | null

  // Parcours
  gpx_url: string | null
  swim_gpx_url: string | null
  bike_gpx_url: string | null
  run_gpx_url: string | null

  // Météo (scrappable sur certaines pages)
  avg_water_temp_celsius: number | null
  avg_temp_high_celsius: number | null
  avg_temp_low_celsius: number | null
  avg_wind_kmh: number | null

  // Statut
  registration_status: string | null

  // Parsed GPX data — populated automatically during scraping, not shown in form UI
  track_geojson: Record<string, unknown> | null
  elevation_profile: Record<string, unknown> | null
}

export interface ConflictItem {
  field: keyof ScrapedFields
  label: string
  options: { url: string; value: unknown }[]
  chosenIndex: number
}

export const SCRAPABLE_FIELD_META = [
  { key: 'name', label: 'Nom' },
  { key: 'date', label: 'Date' },
  { key: 'city', label: 'Ville' },
  { key: 'country', label: 'Pays' },
  { key: 'region', label: 'Région' },
  { key: 'department', label: 'Département' },
  { key: 'description', label: 'Description' },
  { key: 'tagline', label: 'Accroche' },
  { key: 'image_url', label: 'Image' },
  { key: 'price_euros', label: 'Prix (€)' },
  { key: 'latitude', label: 'Latitude' },
  { key: 'longitude', label: 'Longitude' },
  { key: 'category', label: 'Catégorie' },
  { key: 'swim_distance', label: 'Natation (m)' },
  { key: 'bike_distance', label: 'Vélo (m)' },
  { key: 'run_distance', label: 'Course à pied (m)' },
  { key: 'bike_elevation', label: 'Dénivelé vélo (m)' },
  { key: 'run_elevation', label: 'Dénivelé course (m)' },
  { key: 'max_participants', label: 'Participants max' },
  { key: 'time_limit_hours', label: 'Temps limite (h)' },
  { key: 'website_url', label: 'Site web' },
  { key: 'registration_url', label: "Lien d'inscription" },
  { key: 'finishers_url', label: 'Lien finishers' },
  { key: 'organizer_name', label: 'Organisateur' },
  { key: 'source', label: 'Source' },
  // Barrières horaires
  { key: 'swim_cutoff_minutes', label: 'Barrière natation (min)' },
  { key: 'bike_cutoff_minutes', label: 'Barrière vélo (min)' },
  { key: 'run_cutoff_minutes', label: 'Barrière course (min)' },
  { key: 'run_laps', label: 'Nombre de boucles (run)' },
  // Spécificités épreuves
  { key: 'swim_type', label: 'Type de plan d\'eau' },
  { key: 'bike_type', label: 'Type de parcours vélo' },
  { key: 'is_wetsuit_allowed', label: 'Combinaison autorisée' },
  { key: 'is_draft_legal', label: 'Drafting autorisé' },
  // Inscription
  { key: 'registration_deadline', label: 'Date limite d\'inscription' },
  // Records
  { key: 'record_men', label: 'Record hommes' },
  { key: 'record_women', label: 'Record femmes' },
  // Qualification
  { key: 'qualification_for', label: 'Qualification pour' },
  // Contenu
  { key: 'tags', label: 'Tags' },
  { key: 'finishers_count', label: 'Nombre de finishers' },
  // Parcours
  { key: 'gpx_url', label: 'Lien GPX' },
  { key: 'swim_gpx_url', label: 'GPX natation' },
  { key: 'bike_gpx_url', label: 'GPX vélo' },
  { key: 'run_gpx_url', label: 'GPX course' },
  // Météo
  { key: 'avg_water_temp_celsius', label: 'Temp. eau (°C)' },
  { key: 'avg_temp_high_celsius', label: 'Temp. max (°C)' },
  { key: 'avg_temp_low_celsius', label: 'Temp. min (°C)' },
  { key: 'avg_wind_kmh', label: 'Vent moyen (km/h)' },
  // Statut
  { key: 'registration_status', label: 'Statut inscription' },
] as const
