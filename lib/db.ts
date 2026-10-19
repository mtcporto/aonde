import { createClient, type Client } from "@libsql/client";
import {
  RESTAURANTS_DATA,
  HOTELS_DATA,
  TIERS_META,
  TYPE_META,
  FEATURES_META,
  ICONS,
  IMG_BY_CATEGORY,
} from "../js/data.js";

export interface PlaceFeatures {
  accessible?: boolean;
  petFriendly?: boolean;
  kidsSpace?: boolean;
  parking?: boolean;
  wifi?: boolean;
  pool?: boolean;
}

export interface PlaceItem {
  id: number;
  slugId: string;
  kind: "restaurante" | "hotel";
  name: string;
  tier: string;
  price: string;
  type: string;
  typeLabel: string;
  category?: string;
  categoryLabel?: string;
  neighborhood: string;
  address: string;
  lat: number;
  lon: number;
  hours: string;
  checkin?: string;
  checkout?: string;
  phone: string | null;
  instagram: string | null;
  website: string | null;
  image: string;
  statusNote: string | null;
  description: string;
  feat: PlaceFeatures;
}

let cachedClient: Client | null = null;

export function getTursoClient(): Client | null {
  if (cachedClient) return cachedClient;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) return null;
  cachedClient = createClient({
    url,
    authToken,
  });
  return cachedClient;
}

function mapRowToPlace(row: Record<string, any>): PlaceItem {
  let feat: PlaceFeatures = {};
  try {
    if (typeof row.features_json === "string" && row.features_json) {
      feat = JSON.parse(row.features_json);
    }
  } catch {
    feat = {
      accessible: Boolean(row.feat_accessible),
      petFriendly: Boolean(row.feat_pet_friendly),
      kidsSpace: Boolean(row.feat_kids_space),
      parking: Boolean(row.feat_parking),
      wifi: Boolean(row.feat_wifi),
      pool: Boolean(row.feat_pool),
    };
  }

  const kind = (row.kind === "hotel" ? "hotel" : "restaurante") as "restaurante" | "hotel";
  const typeSlug = String(row.type_slug || (kind === "hotel" ? "hotel" : "brasileira"));
  const categoryLabel = String(row.category || "");
  const imgPath = String(row.image || "");

  return {
    id: Number(row.numeric_id),
    slugId: String(row.id),
    kind,
    name: String(row.name),
    tier: String(row.tier || (kind === "hotel" ? "hoteis-orla" : "tradicionais")),
    price: String(row.price || "$$"),
    type: typeSlug,
    typeLabel: categoryLabel,
    category: kind === "hotel" ? typeSlug : undefined,
    categoryLabel: kind === "hotel" ? categoryLabel : undefined,
    neighborhood: String(row.neighborhood || ""),
    address: String(row.address || ""),
    lat: Number(row.lat),
    lon: Number(row.lon),
    hours: String(row.hours || ""),
    checkin: row.checkin ? String(row.checkin) : undefined,
    checkout: row.checkout ? String(row.checkout) : undefined,
    phone: row.phone ? String(row.phone) : null,
    instagram: row.instagram ? String(row.instagram) : null,
    website: row.website ? String(row.website) : null,
    image: imgPath.startsWith("/") ? imgPath : `/${imgPath}`,
    statusNote: row.status_note ? String(row.status_note) : null,
    description: String(row.description || ""),
    feat,
  };
}

export function getFallbackPlaces(): PlaceItem[] {
  const restaurants: PlaceItem[] = (RESTAURANTS_DATA as any[]).map((r) => ({
    id: r.id,
    slugId: `r-${r.id}`,
    kind: "restaurante",
    name: r.name,
    tier: r.tier || "tradicionais",
    price: r.price || "$$",
    type: r.type,
    typeLabel: r.typeLabel,
    neighborhood: r.neighborhood,
    address: r.address,
    lat: r.lat,
    lon: r.lon,
    hours: r.hours || "",
    phone: r.phone || null,
    instagram: r.instagram || null,
    website: r.website || null,
    image: r.image.startsWith("/") ? r.image : `/${r.image}`,
    statusNote: r.statusNote || null,
    description: r.description,
    feat: r.feat || {},
  }));

  const hotels: PlaceItem[] = (HOTELS_DATA as any[]).map((h) => ({
    id: h.id,
    slugId: `h-${h.id}`,
    kind: "hotel",
    name: h.name,
    tier: h.tier || "hoteis-orla",
    price: h.price || "$$$",
    type: h.category,
    typeLabel: h.categoryLabel,
    category: h.category,
    categoryLabel: h.categoryLabel,
    neighborhood: h.neighborhood,
    address: h.address,
    lat: h.lat,
    lon: h.lon,
    hours: `Check-in ${h.checkin || "14h"} · Check-out ${h.checkout || "12h"}`,
    checkin: h.checkin || "14h",
    checkout: h.checkout || "12h",
    phone: h.phone || null,
    instagram: h.instagram || null,
    website: h.website || null,
    image: h.image.startsWith("/") ? h.image : `/${h.image}`,
    statusNote: h.statusNote || null,
    description: h.description,
    feat: h.feat || {},
  }));

  return [...restaurants, ...hotels];
}

export async function getAllPlaces(): Promise<{ items: PlaceItem[]; source: "turso" | "fallback" }> {
  const client = getTursoClient();
  if (client) {
    try {
      const res = await client.execute("SELECT * FROM places ORDER BY name ASC");
      if (res.rows && res.rows.length > 0) {
        return {
          items: res.rows.map((r) => mapRowToPlace(r as Record<string, any>)),
          source: "turso",
        };
      }
    } catch (err) {
      console.warn("Turso query fallback activated:", (err as Error).message);
    }
  }
  return {
    items: getFallbackPlaces(),
    source: "fallback",
  };
}

export async function getPlaceById(slugOrId: string): Promise<{
  place: PlaceItem | null;
  related: PlaceItem[];
  source: "turso" | "fallback";
}> {
  const normalized = String(slugOrId || "").trim();
  const { items, source } = await getAllPlaces();

  let place =
    items.find((p) => p.slugId === normalized) ||
    items.find((p) => String(p.id) === normalized) ||
    null;

  if (!place) {
    return { place: null, related: [], source };
  }

  const candidates = items.filter((p) => p.slugId !== place!.slugId && p.kind === place!.kind);
  const scored = candidates.map((c) => {
    const dLat = c.lat - place!.lat;
    const dLon = c.lon - place!.lon;
    const dist = Math.sqrt(dLat * dLat + dLon * dLon);
    const sameTierBonus = c.tier === place!.tier ? -0.05 : 0;
    const sameTypeBonus = c.type === place!.type ? -0.03 : 0;
    const sameNeighborhoodBonus = c.neighborhood === place!.neighborhood ? -0.02 : 0;
    return {
      item: c,
      score: dist + sameTierBonus + sameTypeBonus + sameNeighborhoodBonus,
    };
  });

  scored.sort((a, b) => a.score - b.score);
  const related = scored.slice(0, 3).map((s) => s.item);

  return { place, related, source };
}

export { TIERS_META, TYPE_META, FEATURES_META, ICONS, IMG_BY_CATEGORY };
