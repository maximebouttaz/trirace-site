import { ArrowRight, Zap } from 'lucide-react';

const TRICOACH_URL = process.env.NEXT_PUBLIC_TRICOACH_URL || 'https://tricoach.app';

export default function CTABanner({ raceSlug, raceName }: { raceSlug?: string; raceName?: string }) {
  const href = raceSlug
    ? `${TRICOACH_URL}/races/${raceSlug}`
    : TRICOACH_URL;

  return (
    <div className="bg-gradient-to-r from-red-600/10 to-orange-600/10 border border-red-500/20 rounded-2xl p-6 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Zap size={16} className="text-red-500" />
            <span className="text-xs font-bold text-red-400 uppercase tracking-wider">TriCoach</span>
          </div>
          <h3 className="text-lg font-bold text-zinc-900 mb-1">
            {raceName
              ? `Prépare ${raceName} avec un coaching personnalisé`
              : 'Planifie ta saison avec un coaching personnalisé'}
          </h3>
          <p className="text-sm text-zinc-500">
            Plans d&apos;entraînement, suivi de performance, coaching IA.
          </p>
        </div>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-red-500/20 transition-all whitespace-nowrap"
        >
          Commencer <ArrowRight size={16} />
        </a>
      </div>
    </div>
  );
}
