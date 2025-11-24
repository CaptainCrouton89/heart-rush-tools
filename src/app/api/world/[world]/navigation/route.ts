import { NextRequest, NextResponse } from "next/server";
import { getWorldNavigationTree } from "../../../../../lib/content";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ world: string }> }
) {
  try {
    const { world } = await context.params;
    const navigation = await getWorldNavigationTree(world);
    return NextResponse.json(navigation);
  } catch (error) {
    console.error(`Error fetching ${(await context.params).world} world navigation:`, error);
    return NextResponse.json(
      { error: "Failed to load navigation" },
      { status: 500 }
    );
  }
}
