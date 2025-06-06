import { NextResponse } from 'next/server';
import { getAllContentMetadata } from '../../../../lib/content';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tagsParam = searchParams.get('tags');
    
    const metadata = await getAllContentMetadata();
    
    if (tagsParam) {
      const selectedTags = tagsParam.split(',').map(tag => tag.trim());
      const filtered = metadata.filter(item => 
        selectedTags.every(tag => 
          item.tags.some(itemTag => 
            itemTag.toLowerCase() === tag.toLowerCase()
          )
        )
      );
      return NextResponse.json(filtered);
    }
    
    return NextResponse.json(metadata);
  } catch (error) {
    console.error('Error fetching content metadata:', error);
    return NextResponse.json(
      { error: 'Failed to fetch content metadata' },
      { status: 500 }
    );
  }
}