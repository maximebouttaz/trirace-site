import Link from 'next/link';
import { Trophy } from 'lucide-react';

const TRICOACH_URL = process.env.NEXT_PUBLIC_TRICOACH_URL || 'https://tricoach.app';

export default function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-200/50 mt-20">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center">
                <Trophy size={16} className="text-white" />
              </div>
              <span className="text-lg font-bold text-zinc-900 tracking-tight">
                Tri<span className="text-red-500">Race</span>
              </span>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Trouve ta prochaine course triathlon parmi 700+ courses en France et en Europe.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-sm font-bold text-zinc-600 uppercase tracking-wider mb-4">Navigation</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/courses" className="text-sm text-zinc-400 hover:text-zinc-900 transition">
                  Toutes les courses
                </Link>
              </li>
              <li>
                <a href={TRICOACH_URL} target="_blank" rel="noopener noreferrer" className="text-sm text-zinc-400 hover:text-zinc-900 transition">
                  TriCoach — Coaching personnalisé
                </a>
              </li>
            </ul>
          </div>

          {/* CTA */}
          <div>
            <h4 className="text-sm font-bold text-zinc-600 uppercase tracking-wider mb-4">Prépare ta saison</h4>
            <p className="text-sm text-zinc-400 mb-4">
              Plans d&apos;entraînement personnalisés, suivi de performance, coaching IA.
            </p>
            <a
              href={TRICOACH_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 text-white text-sm font-bold rounded-xl hover:shadow-lg hover:shadow-red-500/20 transition-all"
            >
              Commencer avec TriCoach
            </a>
          </div>
        </div>

        <div className="border-t border-gray-200/50 mt-10 pt-6 text-center">
          <p className="text-xs text-zinc-400">
            © {new Date().getFullYear()} TriRace. Données courses : Finishers.com.
          </p>
        </div>
      </div>
    </footer>
  );
}
