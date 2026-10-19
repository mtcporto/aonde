import { getPlaceById } from "@/lib/db";
import DetailClient from "@/components/DetailClient";

export const dynamic = "force-dynamic";

export default async function DetalhesSlugPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { place, related, source } = await getPlaceById(id);

  return <DetailClient place={place} related={related} source={source} />;
}
