import { NextResponse } from 'next/server';
import { getNavigationTree } from '../../../../../lib/content';
import { Breadcrumb } from '../../../../../types/content';

// Generate category slug from name
function generateCategorySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug: categorySlug } = await params;
    
    if (!categorySlug) {
      return NextResponse.json(
        { error: 'Category slug parameter is required' },
        { status: 400 }
      );
    }

    const navigation = await getNavigationTree();
    
    // Find the category by slug
    const category = navigation.find(item => 
      item.type === 'category' && item.name && generateCategorySlug(item.name) === categorySlug
    );

    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Create breadcrumbs for category page
    const breadcrumbs: Breadcrumb[] = [
      {
        slug: 'home',
        title: 'Home',
        level: 0
      },
      {
        slug: categorySlug,
        title: category.name || 'Unknown Category',
        level: 1
      }
    ];

    return NextResponse.json(breadcrumbs);
  } catch (error) {
    console.error('Error fetching category breadcrumbs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch category breadcrumbs' },
      { status: 500 }
    );
  }
}