import { notFound } from 'next/navigation';
import {
  getWorldContentBySlug,
  getAllWorldContentMetadata,
  getWorldAdjacentContent,
  getWorldChildContent
} from '../../../../lib/content';
import { MainContent } from '../../../../components/layout/MainContent';
import fs from 'fs/promises';
import path from 'path';

// Get all available worlds
async function getAvailableWorlds(): Promise<string[]> {
  try {
    const worldsDir = path.join(process.cwd(), 'content/worlds');
    const entries = await fs.readdir(worldsDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

// Disable dynamic params to prevent fallback for invalid slugs
export const dynamicParams = false;

// Generate static params for all world content pages
export async function generateStaticParams() {
  const worlds = await getAvailableWorlds();
  const params: Array<{ world: string; slug: string }> = [];

  for (const world of worlds) {
    const allMetadata = await getAllWorldContentMetadata(world);
    // Skip worlds with no content
    if (allMetadata.length === 0) {
      continue;
    }

    for (const item of allMetadata) {
      params.push({
        world,
        slug: item.slug
      });
    }
  }

  return params;
}

// Generate metadata for SEO
export async function generateMetadata({
  params
}: {
  params: Promise<{ world: string; slug: string }>;
}) {
  const { world, slug } = await params;
  const content = await getWorldContentBySlug(world, slug);

  if (!content) {
    return {
      title: 'World Page Not Found | Heart Rush Rulebook'
    };
  }

  // Extract first 160 characters from content for description
  const description = content.content.replace(/[#*`]/g, '').slice(0, 160).trim() + '...';
  const worldTitle = world.charAt(0).toUpperCase() + world.slice(1);

  return {
    title: `${content.title} | ${worldTitle} | Heart Rush`,
    description: description || `${content.title} - ${worldTitle} world wiki`,
    openGraph: {
      title: `${content.title} | ${worldTitle} | Heart Rush`,
      description: description || `${content.title} - ${worldTitle} world wiki`,
      type: 'article'
    }
  };
}

export default async function WorldContentPage({
  params
}: {
  params: Promise<{ world: string; slug: string }>;
}) {
  const { world, slug } = await params;
  const content = await getWorldContentBySlug(world, slug);

  if (!content) {
    notFound();
  }

  const { previous, next } = await getWorldAdjacentContent(world, slug);
  const childContent = await getWorldChildContent(world, slug);

  return <MainContent content={content} previousContent={previous} nextContent={next} childContent={childContent} />;
}
