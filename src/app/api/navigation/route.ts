import { NextResponse } from 'next/server';
import { getNavigationTree } from '../../../lib/content';

export async function GET() {
  try {
    const navigation = await getNavigationTree();
    return NextResponse.json(navigation);
  } catch (error) {
    console.error('Error fetching navigation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch navigation' },
      { status: 500 }
    );
  }
}