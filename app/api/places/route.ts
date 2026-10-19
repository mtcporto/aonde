import { NextRequest, NextResponse } from "next/server";
import { getAllPlaces, TIERS_META, TYPE_META, FEATURES_META } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind");
  const type = searchParams.get("type");
  const tier = searchParams.get("tier");
  const neighborhood = searchParams.get("neighborhood");
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const amenitiesParam = searchParams.get("amenities");
  const amenities = amenitiesParam ? amenitiesParam.split(",").filter(Boolean) : [];

  const { items, source } = await getAllPlaces();

  const filtered = items.filter((item) => {
    if (kind && kind !== "todos" && item.kind !== kind) return false;
    if (type && type !== "todos" && item.type !== type) return false;
    if (tier && tier !== "todos" && item.tier !== tier) return false;
    if (neighborhood && neighborhood !== "todos" && item.neighborhood !== neighborhood) return false;
    if (q) {
      const hay = `${item.name} ${item.typeLabel} ${item.neighborhood} ${item.address} ${item.description}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    for (const am of amenities) {
      if (!(item.feat as Record<string, boolean | undefined>)?.[am]) return false;
    }
    return true;
  });

  return NextResponse.json({
    source,
    total: filtered.length,
    items: filtered,
    tiers: TIERS_META,
    types: TYPE_META,
    features: FEATURES_META,
  });
}
