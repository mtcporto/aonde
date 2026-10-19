import { getAllPlaces } from "@/lib/db";
import HomeClient from "@/components/HomeClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { items, source } = await getAllPlaces();
  return <HomeClient initialItems={items} source={source} />;
}
