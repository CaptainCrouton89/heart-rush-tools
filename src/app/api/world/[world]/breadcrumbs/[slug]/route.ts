import { NextRequest, NextResponse } from "next/server";
import { getWorldBreadcrumbs } from "../../../../../../lib/content";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ world: string; slug: string }> }
) {
  try {
    const { world, slug } = await context.params;
    const breadcrumbs = await getWorldBreadcrumbs(world, slug);
    return NextResponse.json(breadcrumbs);
  } catch (error) {
    const params = await context.params;
    console.error(`Error fetching breadcrumbs for ${params.world}/${params.slug}:`, error);
    return NextResponse.json(
      { error: "Failed to load breadcrumbs" },
      { status: 500 }
    );
  }
}
