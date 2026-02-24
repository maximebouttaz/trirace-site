import type { Race } from '@/lib/types';
import RaceCard from '@/components/RaceCard';

interface RelatedRacesProps {
  relatedRaces: Race[];
}

export default function RelatedRaces({ relatedRaces }: RelatedRacesProps) {
  const related = relatedRaces.slice(0, 3);

  if (related.length < 1) return null;

  return (
    <section className="bg-gray-50 rounded-3xl border border-gray-200 p-6">
      <h2 className="text-xl font-bold text-zinc-900 mb-6">Courses similaires</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {related.map((race) => (
          <RaceCard key={race.id} race={race} />
        ))}
      </div>
    </section>
  );
}
