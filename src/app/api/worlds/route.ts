import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET() {
  try {
    const worldsDir = path.join(process.cwd(), "content/worlds");

    // Check if worlds directory exists
    try {
      await fs.access(worldsDir);
    } catch {
      return NextResponse.json({ worlds: [] });
    }

    // Get all world directories
    const entries = await fs.readdir(worldsDir, { withFileTypes: true });
    const worlds = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    return NextResponse.json({ worlds });
  } catch (error) {
    console.error("Error fetching worlds:", error);
    return NextResponse.json({ worlds: [], error: "Failed to load worlds" }, { status: 500 });
  }
}
