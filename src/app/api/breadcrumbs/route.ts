import { NextResponse } from 'next/server';
import { getBreadcrumbs } from '../../../lib/content';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    
    if (!slug) {
      return NextResponse.json(
        { error: 'Slug parameter is required' },
        { status: 400 }
      );
    }

    const breadcrumbs = await getBreadcrumbs(slug);
    return NextResponse.json(breadcrumbs);
  } catch (error) {
    console.error('Error fetching breadcrumbs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch breadcrumbs' },
      { status: 500 }
    );
  }
}