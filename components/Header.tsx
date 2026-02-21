import Link from 'next/link';
import { Trophy, ArrowRight, LayoutDashboard } from 'lucide-react';

const TRICOACH_URL = process.env.NEXT_PUBLIC_TRICOACH_URL || 'https://tricoach.app';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center">
            <Trophy size={16} className="text-white" />
          </div>
          <span className="text-lg font-bold text-zinc-900 tracking-tight">
            Tri<span className="text-red-500">Race</span>
          </span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-6">
          <Link
            href="/courses"
            className="text-sm font-semibold text-zinc-500 hover:text-zinc-900 transition"
          >
            Courses
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm font-semibold text-zinc-500 hover:text-zinc-900 transition"
          >
            <LayoutDashboard size={14} />
            Organisateurs
          </Link>
          <a
            href={TRICOACH_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-rose-600 text-white text-sm font-bold rounded-xl hover:shadow-lg hover:shadow-red-500/20 transition-all"
          >
            Planifier ma saison <ArrowRight size={14} />
          </a>
        </nav>
      </div>
    </header>
  );
}
