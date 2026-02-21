import type { Race } from '@/lib/types';
import RaceCard from '@/components/RaceCard';

interface RelatedRacesProps {
  currentRace: Race;
  allRaces: Race[];
}

export default function RelatedRaces({ currentRace, allRaces }: RelatedRacesProps) {
  const others = allRaces.filter((r) => r.id !== currentRace.id);

  // Priority 1: same category AND same country
  const sameCategoryAndCountry = others.filter(
    (r) => r.category === currentRace.category && r.country === currentRace.country
  );

  // Priority 2: same category only (excluding those already in priority 1)
  const sameCategoryOnly = others.filter(
    (r) => r.category === currentRace.category && r.country !== currentRace.country
  );

  const related: Race[] = [];

  for (const r of sameCategoryAndCountry) {
    if (related.length >= 3) break;
    related.push(r);
  }

  for (const r of sameCategoryOnly) {
    if (related.length >= 3) break;
    related.push(r);
  }

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
