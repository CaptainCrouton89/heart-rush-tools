import { notFound } from 'next/navigation';
import { getContentBySlug, getAllContentMetadata } from '../../lib/content';
import { MainContent } from '../../components/layout/MainContent';

// Generate static params for all content pages
export async function generateStaticParams() {
  const allMetadata = await getAllContentMetadata();
  return allMetadata.map(item => ({
    slug: item.slug
  }));
}

// Generate metadata for SEO
export async function generateMetadata({ params }: { params: { slug: string } }) {
  const content = await getContentBySlug(params.slug);
  
  if (!content) {
    return {
      title: 'Page Not Found | Heart Rush Rulebook'
    };
  }
  
  return {
    title: `${content.title} | Heart Rush Rulebook`,
    description: content.description || `${content.title} - Heart Rush TTRPG rules and guidance`,
    openGraph: {
      title: `${content.title} | Heart Rush Rulebook`,
      description: content.description || `${content.title} - Heart Rush TTRPG rules and guidance`,
      type: 'article'
    }
  };
}

export default async function ContentPage({ params }: { params: { slug: string } }) {
  const content = await getContentBySlug(params.slug);
  
  if (!content) {
    notFound();
  }
  
  return <MainContent content={content} />;
}