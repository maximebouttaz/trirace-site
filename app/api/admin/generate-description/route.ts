import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase-server'

const client = new Anthropic()

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', session.user.id).single<{ role: string }>()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })

  const body = await request.json()

  const {
    name, city, country, date, category,
    swim_distance, bike_distance, run_distance,
    total_elevation, swim_type, bike_type,
    price_euros, time_limit_hours,
    qualification_for, is_draft_legal,
  } = body

  // Formater les distances
  const swimKm = swim_distance ? (Number(swim_distance) / 1000).toFixed(1) + ' km' : null
  const bikeKm = bike_distance ? (Number(bike_distance) / 1000).toFixed(0) + ' km' : null
  const runKm = run_distance ? (Number(run_distance) / 1000).toFixed(1) + ' km' : null

  const infos = [
    name && `Nom : ${name}`,
    city && country && `Lieu : ${city}, ${country}`,
    date && `Date : ${date}`,
    category && `Format : ${category}`,
    swimKm && `Natation : ${swimKm}${swim_type ? ` (${swim_type})` : ''}`,
    bikeKm && `Vélo : ${bikeKm}${total_elevation ? ` / ${total_elevation} m D+` : ''}`,
    runKm && `Course à pied : ${runKm}`,
    price_euros && `Prix : ${price_euros} €`,
    time_limit_hours && `Barrière horaire : ${time_limit_hours}h`,
    qualification_for && `Qualification pour : ${qualification_for}`,
    is_draft_legal === 'true' && `Drafting autorisé`,
    bike_type && `Type de vélo : ${bike_type}`,
  ].filter(Boolean).join('\n')

  const prompt = `Tu es un rédacteur web spécialisé en sports d'endurance. Rédige une description de course de triathlon pour un site web francophone.

Informations sur la course :
${infos}

Consignes :
- Exactement 130 à 160 mots
- En français, ton dynamique et inspirant
- Intègre naturellement les mots-clés SEO : nom de la course, ville, "triathlon", format (ex : "70.3", "Ironman", "sprint"...)
- Mentionne les spécificités du parcours (eau, vélo, cap à pied) si les données sont disponibles
- Pas de tirets, pas de listes, texte continu en 2-3 paragraphes
- Termine par une phrase d'accroche pour s'inscrire ou participer
- Texte brut, sans markdown ni titre`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''

  return NextResponse.json({ description: text })
}
