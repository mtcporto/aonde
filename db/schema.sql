CREATE TABLE IF NOT EXISTS places (
  id TEXT PRIMARY KEY,
  numeric_id INTEGER NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  type_slug TEXT NOT NULL,
  tier TEXT NOT NULL,
  price TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  address TEXT NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  hours TEXT NOT NULL,
  checkin TEXT DEFAULT '',
  checkout TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  instagram TEXT DEFAULT '',
  website TEXT DEFAULT '',
  image TEXT NOT NULL,
  status_note TEXT DEFAULT '',
  description TEXT NOT NULL,
  feat_accessible INTEGER NOT NULL DEFAULT 0,
  feat_pet_friendly INTEGER NOT NULL DEFAULT 0,
  feat_kids_space INTEGER NOT NULL DEFAULT 0,
  feat_parking INTEGER NOT NULL DEFAULT 0,
  feat_wifi INTEGER NOT NULL DEFAULT 0,
  feat_pool INTEGER NOT NULL DEFAULT 0,
  features_json TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_places_kind ON places(kind);
CREATE INDEX IF NOT EXISTS idx_places_type_slug ON places(type_slug);
CREATE INDEX IF NOT EXISTS idx_places_tier ON places(tier);
CREATE INDEX IF NOT EXISTS idx_places_neighborhood ON places(neighborhood);
CREATE INDEX IF NOT EXISTS idx_places_price ON places(price);

CREATE TABLE IF NOT EXISTS tiers_meta (
  slug TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  short_label TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  price_hint TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  kind TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories_meta (
  slug TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  badge_class TEXT NOT NULL,
  icon_svg TEXT NOT NULL
);
