import { notFound } from "next/navigation";
import { MainContent } from "../../components/layout/MainContent";
import {
  getAdjacentContent,
  getAllContentMetadata,
  getChildContent,
  getContentBySlug,
} from "../../lib/content";

// Generate static params for all content pages
export async function generateStaticParams() {
  const allMetadata = await getAllContentMetadata();
  return allMetadata.map((item) => ({
    slug: item.slug,
  }));
}

// Generate metadata for SEO
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const content = await getContentBySlug(slug);

  if (!content) {
    return {
      title: "Page Not Found | Heart Rush Rulebook",
    };
  }

  // Extract first 160 characters from content for description
  const description =
    content.content.replace(/[#*`]/g, "").slice(0, 160).trim() + "...";

  return {
    title: `${content.title} | Heart Rush Rulebook`,
    description:
      description || `${content.title} - Heart Rush TTRPG rules and guidance`,
    openGraph: {
      title: `${content.title} | Heart Rush Rulebook`,
      description:
        description || `${content.title} - Heart Rush TTRPG rules and guidance`,
      type: "article",
    },
  };
}

export default async function ContentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const content = await getContentBySlug(slug);

  if (!content) {
    notFound();
  }

  const { previous, next } = await getAdjacentContent(slug);
  const childContent = await getChildContent(slug);

  return (
    <MainContent
      content={content}
      previousContent={previous}
      nextContent={next}
      childContent={childContent}
    />
  );
}
