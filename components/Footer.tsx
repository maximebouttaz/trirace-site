import Link from 'next/link';
import { Trophy, ArrowRight, Map, GitCompareArrows, CalendarDays } from 'lucide-react';

const TRICOACH_URL = process.env.NEXT_PUBLIC_TRICOACH_URL || 'https://tricoach.app';

export default function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-200/60 mt-20">
      <div className="max-w-7xl mx-auto px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand — spans 1 col */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center shadow-sm">
                <Trophy size={16} className="text-white" aria-hidden="true" />
              </div>
              <span className="text-lg font-bold text-zinc-900 tracking-tight">
                Tri<span className="text-red-500">Race</span>
              </span>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed">
              La référence des courses triathlon en France et en Europe.
            </p>
          </div>

          {/* Explore */}
          <div>
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Explorer</h4>
            <ul className="space-y-2.5">
              <li>
                <Link
                  href="/courses"
                  className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors duration-150 flex items-center gap-2"
                >
                  Toutes les courses
                </Link>
              </li>
              <li>
                <Link
                  href="/carte"
                  className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors duration-150 flex items-center gap-2"
                >
                  <Map size={13} className="text-zinc-400 shrink-0" aria-hidden="true" />
                  Carte interactive
                </Link>
              </li>
              <li>
                <Link
                  href="/calendrier"
                  className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors duration-150 flex items-center gap-2"
                >
                  <CalendarDays size={13} className="text-zinc-400 shrink-0" aria-hidden="true" />
                  Calendrier
                </Link>
              </li>
              <li>
                <Link
                  href="/comparateur"
                  className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors duration-150 flex items-center gap-2"
                >
                  <GitCompareArrows size={13} className="text-zinc-400 shrink-0" aria-hidden="true" />
                  Comparateur
                </Link>
              </li>
            </ul>
          </div>

          {/* Organisateurs */}
          <div>
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Organisateurs</h4>
            <ul className="space-y-2.5">
              <li>
                <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors duration-150">
                  Espace organisateur
                </Link>
              </li>
              <li>
                <Link href="/signup" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors duration-150">
                  Créer un compte
                </Link>
              </li>
              <li>
                <Link href="/login" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors duration-150">
                  Se connecter
                </Link>
              </li>
            </ul>
          </div>

          {/* CTA TriCoach */}
          <div>
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Prépare ta saison</h4>
            <p className="text-sm text-zinc-400 mb-4 leading-relaxed">
              Plans d&apos;entraînement personnalisés, suivi de performance, coaching IA.
            </p>
            <a
              href={TRICOACH_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-600 to-orange-500 text-white text-sm font-bold rounded-xl hover:shadow-md hover:shadow-red-500/20 hover:scale-[1.02] transition-all duration-300"
            >
              Commencer avec TriCoach
              <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform duration-200" aria-hidden="true" />
            </a>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-200/60 mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-zinc-400">
            &copy; {new Date().getFullYear()} TriRace. Donn&eacute;es courses&nbsp;: Finishers.com.
          </p>
          <p className="text-xs text-zinc-300">
            Fait avec passion pour les triathletes
          </p>
        </div>
      </div>
    </footer>
  );
}
