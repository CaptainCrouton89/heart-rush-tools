import { notFound } from 'next/navigation';
import { getGMContentBySlug, getAllGMContentMetadata, getGMAdjacentContent, getGMChildContent } from '../../../lib/content';
import { MainContent } from '../../../components/layout/MainContent';

// Generate static params for all GM content pages
export async function generateStaticParams() {
  const allMetadata = await getAllGMContentMetadata();
  return allMetadata.map(item => ({
    slug: item.slug
  }));
}

// Generate metadata for SEO
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const content = await getGMContentBySlug(slug);
  
  if (!content) {
    return {
      title: 'GM Page Not Found | Heart Rush Rulebook'
    };
  }
  
  // Extract first 160 characters from content for description
  const description = content.content.replace(/[#*`]/g, '').slice(0, 160).trim() + '...';
  
  return {
    title: `${content.title} | Heart Rush GM Guide`,
    description: description || `${content.title} - Heart Rush TTRPG GM guidance`,
    openGraph: {
      title: `${content.title} | Heart Rush GM Guide`,
      description: description || `${content.title} - Heart Rush TTRPG GM guidance`,
      type: 'article'
    }
  };
}

export default async function GMContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const content = await getGMContentBySlug(slug);
  
  if (!content) {
    notFound();
  }
  
  const { previous, next } = await getGMAdjacentContent(slug);
  const childContent = await getGMChildContent(slug);
  
  return <MainContent content={content} previousContent={previous} nextContent={next} childContent={childContent} />;
}