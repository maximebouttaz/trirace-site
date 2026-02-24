'use client';

import { Heart } from 'lucide-react';
import { useFavorites } from '@/lib/hooks/useFavorites';

export default function FavoriteButton({ slug }: { slug: string }) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const active = isFavorite(slug);

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(slug);
      }}
      aria-label={active ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      className={`absolute top-3 left-3 w-7 h-7 rounded-full flex items-center justify-center backdrop-blur transition-all z-10 ${
        active
          ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
          : 'bg-black/40 text-white hover:bg-black/60'
      }`}
    >
      <Heart size={13} className={active ? 'fill-white' : ''} />
    </button>
  );
}
