import { NextResponse } from 'next/server';
import { getAllContentMetadata } from '../../../../lib/content';

export async function GET() {
  try {
    const metadata = await getAllContentMetadata();
    return NextResponse.json(metadata);
  } catch (error) {
    console.error('Error fetching content metadata:', error);
    return NextResponse.json(
      { error: 'Failed to fetch content metadata' },
      { status: 500 }
    );
  }
}