'use client';

import { memo } from 'react';
import { Heart } from 'lucide-react';
import { useFavorites } from '@/lib/hooks/useFavorites';

function FavoriteButton({ slug }: { slug: string }) {
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
      className={`w-8 h-8 rounded-full flex items-center justify-center backdrop-blur transition-all duration-200 active:scale-75 hover:scale-110 ${
        active
          ? 'bg-red-500 text-white shadow-lg shadow-red-500/40'
          : 'bg-black/40 text-white hover:bg-black/60'
      }`}
    >
      <Heart size={14} className={`transition-all duration-200 ${active ? 'fill-white scale-110' : ''}`} />
    </button>
  );
}

export default memo(FavoriteButton);
