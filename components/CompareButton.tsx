'use client';

import { Plus, Check } from 'lucide-react';
import { useCompare } from '@/lib/compare-context';

export default function CompareButton({ slug }: { slug: string }) {
  const { addRace, removeRace, isSelected, isFull } = useCompare();
  const selected = isSelected(slug);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (selected) {
      removeRace(slug);
    } else if (!isFull) {
      addRace(slug);
    }
  };

  if (!selected && isFull) return null;

  return (
    <button
      onClick={handleClick}
      title={selected ? 'Retirer du comparateur' : 'Ajouter au comparateur'}
      className={`absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center transition-all z-10 ${
        selected
          ? 'bg-red-500 text-white shadow-lg'
          : 'bg-black/40 backdrop-blur text-white hover:bg-black/60'
      }`}
    >
      {selected ? <Check size={14} /> : <Plus size={14} />}
    </button>
  );
}
