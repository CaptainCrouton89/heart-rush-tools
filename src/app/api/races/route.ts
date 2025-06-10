import { NextResponse } from 'next/server';
import { getAllRaces, getRaceById } from '@/lib/talents-races';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const race = await getRaceById(id);
      if (!race) {
        return NextResponse.json({ error: 'Race not found' }, { status: 404 });
      }
      return NextResponse.json(race);
    }

    const races = await getAllRaces();

    return NextResponse.json({
      races,
      count: races.length
    });
  } catch (error) {
    console.error('Error fetching races:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}