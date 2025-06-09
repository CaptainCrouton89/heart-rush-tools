import { NextResponse } from 'next/server';
import { getGMNavigationTree } from '../../../../lib/content';

export async function GET() {
  try {
    const navigation = await getGMNavigationTree();
    return NextResponse.json(navigation);
  } catch (error) {
    console.error('Error fetching GM navigation:', error);
    return NextResponse.json([], { status: 500 });
  }
}