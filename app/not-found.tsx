import Link from 'next/link';
import { Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <Search size={48} className="mx-auto text-zinc-300 mb-4" />
        <h2 className="text-2xl font-bold text-zinc-900 mb-2">Page introuvable</h2>
        <p className="text-zinc-500 mb-6">Cette page n&apos;existe pas ou a été supprimée.</p>
        <Link
          href="/courses"
          className="px-6 py-3 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-xl font-bold"
        >
          Explorer les courses
        </Link>
      </div>
    </div>
  );
}
