export type ScraperSource = 'finishers' | 'milesrepublic' | 'ironman' | 'generic'

/**
 * Détecte la source d'une URL de course afin de choisir le scraper spécialisé.
 * Robuste aux variations de sous-domaines (www., eu., staging., etc.)
 */
export function detectSource(url: string): ScraperSource {
  try {
    const { hostname } = new URL(url)
    const host = hostname.toLowerCase()

    if (host.includes('finishers.com') || host.includes('finishers.fr')) {
      return 'finishers'
    }

    if (host.includes('milesrepublic.com')) {
      return 'milesrepublic'
    }

    if (host.includes('ironman.com')) {
      return 'ironman'
    }

    return 'generic'
  } catch {
    // URL invalide ou relative — on retombe sur le scraper générique
    return 'generic'
  }
}
