import Link from "next/link";
import { getNavigationTree, getCategories } from '../lib/content';

export default async function HomePage() {
  const navigation = await getNavigationTree();
  const categories = await getCategories();

  // Get top-level navigation items (usually the main sections)
  const mainSections = navigation.slice(0, 6);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <header className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Heart Rush Digital Rulebook
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-2">
          Welcome to the official digital rulebook for Heart Rush TTRPG
        </p>
        <p className="text-gray-500 dark:text-gray-400">
          Navigate through {navigation.length} sections of rules, lore, and gameplay guidance
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {mainSections.map(section => (
          <div 
            key={section.slug} 
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-md transition-shadow"
          >
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {section.title}
            </h2>
            
            {section.children && section.children.length > 0 && (
              <ul className="space-y-2 mb-4">
                {section.children.slice(0, 4).map(child => (
                  <li key={child.slug}>
                    <Link 
                      href={`/${child.slug}`} 
                      className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                    >
                      {child.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            
            <Link 
              href={`/${section.slug}`} 
              className="inline-block text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 text-sm font-medium"
            >
              Explore {section.title} →
            </Link>
          </div>
        ))}
      </div>

      {categories.length > 0 && (
        <section>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
            Browse by Category
          </h2>
          <div className="flex flex-wrap gap-2">
            {categories.map(category => (
              <Link
                key={category}
                href={`/search?category=${encodeURIComponent(category)}`}
                className="inline-block px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                {category}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
