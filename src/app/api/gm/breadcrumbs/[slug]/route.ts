import { NextResponse } from 'next/server';
import { getGMBreadcrumbs } from '../../../../../lib/content';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const breadcrumbs = await getGMBreadcrumbs(slug);
    return NextResponse.json(breadcrumbs);
  } catch (error) {
    console.error('Error fetching GM breadcrumbs:', error);
    return NextResponse.json([], { status: 500 });
  }
}