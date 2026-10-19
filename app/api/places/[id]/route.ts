import { NextRequest, NextResponse } from "next/server";
import { getPlaceById } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const { place, related, source } = await getPlaceById(id);

  if (!place) {
    return NextResponse.json(
      { error: "Estabelecimento não encontrado", source },
      { status: 404 }
    );
  }

  return NextResponse.json({
    source,
    place,
    related,
  });
}
