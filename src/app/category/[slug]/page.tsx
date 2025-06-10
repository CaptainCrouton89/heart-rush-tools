import Link from "next/link";
import { getNavigationTree } from "../../../lib/content";
import { CategorizedNavigationNode } from "../../../types/content";

interface CategoryPageProps {
  params: {
    slug: string;
  };
}

// Generate category slug from name
function generateCategorySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

// Find category by slug
function findCategoryBySlug(
  navigation: CategorizedNavigationNode[],
  slug: string
): CategorizedNavigationNode | null {
  for (const item of navigation) {
    if (item.type === "category") {
      const categorySlug = generateCategorySlug(item.name || "");
      if (categorySlug === slug) {
        return item;
      }
    }
  }
  return null;
}

// Get main sections for this category (not nested subsections)
function getMainSections(
  category: CategorizedNavigationNode
): CategorizedNavigationNode[] {
  if (!category.children) return [];

  // Return only the direct children that are sections
  return category.children.filter((child) => child.type === "section");
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const navigation = await getNavigationTree();
  const category = findCategoryBySlug(navigation, params.slug);

  if (!category) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground mb-4">
            Category Not Found
          </h1>
          <p className="text-muted-foreground mb-6">
            The category you're looking for doesn't exist.
          </p>
          <Link
            href="/"
            className="inline-block bg-primary text-primary-foreground px-6 py-2 rounded-lg hover:bg-primary/90 transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // Get main sections in this category (not nested subsections)
  const mainSections = getMainSections(category);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumbs */}
      <nav className="mb-6">
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-primary transition-colors">
            Home
          </Link>
          <span>/</span>
          <span className="text-foreground">{category.name}</span>
        </div>
      </nav>

      {/* Header */}
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-primary mb-4">
          {category.name}
        </h1>
        <p className="text-xl text-muted-foreground">
          {mainSections.length} main sections in this category
        </p>
      </header>

      {/* Sections List */}
      <div className="space-y-4">
        {mainSections.map((section) => (
          <Link
            key={section.slug}
            href={`/${section.slug}`}
            className="block bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-all duration-200 hover:border-primary/30"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-card-foreground mb-2 hover:text-primary transition-colors">
                  {section.title}
                </h3>

                {/* Show subsection count if any */}
                {section.children && section.children.length > 0 && (
                  <p className="text-sm text-muted-foreground mb-3">
                    Contains {section.children.length} subsections
                  </p>
                )}
              </div>

              <span className="inline-flex items-center px-4 py-2 text-sm font-medium text-primary rounded-lg transition-colors">
                Explore →
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* Back to categories */}
      <div className="mt-12 pt-8 border-t border-border">
        <Link
          href="/"
          className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors"
        >
          <span className="mr-2">←</span>
          Back to all categories
        </Link>
      </div>
    </div>
  );
}

// Generate static params for all categories
export async function generateStaticParams() {
  const navigation = await getNavigationTree();

  return navigation
    .filter((item) => item.type === "category")
    .map((category) => ({
      slug: generateCategorySlug(category.name || ""),
    }));
}
