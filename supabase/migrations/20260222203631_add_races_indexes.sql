-- Index sur category pour les filtres par type de course
CREATE INDEX IF NOT EXISTS idx_races_category ON races(category);

-- Index sur date pour le tri chronologique (usage le plus fréquent)
CREATE INDEX IF NOT EXISTS idx_races_date ON races(date ASC);

-- Index sur region et country pour les filtres géographiques
CREATE INDEX IF NOT EXISTS idx_races_region ON races(region);
CREATE INDEX IF NOT EXISTS idx_races_country ON races(country);

-- Index composé category + date (filtre + tri combinés, cas le plus courant)
CREATE INDEX IF NOT EXISTS idx_races_category_date ON races(category, date ASC);

-- Index partiel sur price_euros (uniquement les courses avec un prix renseigné)
CREATE INDEX IF NOT EXISTS idx_races_price ON races(price_euros) WHERE price_euros IS NOT NULL;
