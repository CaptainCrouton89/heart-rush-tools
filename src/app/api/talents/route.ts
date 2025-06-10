import { getAllTalents, getTalentById } from "@/lib/talents-races";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const category = searchParams.get("category") as
      | "combat"
      | "noncombat"
      | null;

    if (id) {
      const talent = await getTalentById(id);
      if (!talent) {
        return NextResponse.json(
          { error: "Talent not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(talent);
    }

    let talents = await getAllTalents();

    if (category) {
      talents = talents.filter((talent) => talent.category === category);
    }

    return NextResponse.json({
      talents,
      count: talents.length,
      categories: {
        combat: talents.filter((t) => t.category === "combat").length,
        noncombat: talents.filter((t) => t.category === "noncombat").length,
      },
    });
  } catch (error) {
    console.error("Error fetching talents:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
