'use client';

import { useCompare } from '@/lib/compare-context';

export default function CompareNavIndicator() {
  const { slugs } = useCompare();
  if (slugs.length === 0) return null;

  return (
    <span className="ml-1 w-5 h-5 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
      {slugs.length}
    </span>
  );
}
