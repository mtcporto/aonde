import { getPlaceById } from "@/lib/db";
import DetailClient from "@/components/DetailClient";

export const dynamic = "force-dynamic";

export default async function DetalhesQueryPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const params = await searchParams;
  const id = params?.id || "";
  const { place, related, source } = await getPlaceById(id);

  return <DetailClient place={place} related={related} source={source} />;
}
