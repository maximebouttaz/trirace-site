'use client';

import { memo } from 'react';
import { Plus, Check } from 'lucide-react';
import { useCompare } from '@/lib/compare-context';

function CompareButton({ slug }: { slug: string }) {
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
      className={`group/cmp h-8 rounded-full flex items-center justify-center overflow-hidden transition-all duration-300 active:scale-90 ${
        selected
          ? 'bg-red-500 text-white shadow-lg shadow-red-500/40 w-8'
          : 'bg-black/40 backdrop-blur text-white hover:bg-black/70 w-8 hover:w-[104px]'
      }`}
    >
      {selected
        ? <Check size={14} className="shrink-0 scale-110" />
        : <>
            <Plus size={14} className="shrink-0" />
            <span className="text-[11px] font-semibold whitespace-nowrap w-0 overflow-hidden group-hover/cmp:w-[60px] group-hover/cmp:ml-1.5 transition-all duration-300">
              Comparer
            </span>
          </>
      }
    </button>
  );
}

export default memo(CompareButton);
