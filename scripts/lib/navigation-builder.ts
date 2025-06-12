import fs from "fs/promises";
import { 
  ContentSection, 
  NavigationItem, 
  NavigationCategory, 
  CategorizedNavigationItem 
} from "./types.js";
import { generateCategorySlug } from "./utils.js";

const CATEGORIES_CONFIG_PATH = "navigation-categories.json";
const GM_CATEGORIES_CONFIG_PATH = "gm-navigation-categories.json";

export async function loadNavigationCategories(
  configPath: string = CATEGORIES_CONFIG_PATH
): Promise<NavigationCategory[]> {
  try {
    const categoriesContent = await fs.readFile(configPath, "utf-8");
    const config = JSON.parse(categoriesContent);
    return config.categories || [];
  } catch (error) {
    console.warn(
      `No navigation categories configuration found at ${configPath}, using default alphabetical ordering`
    );
    return [];
  }
}

export function createCategorizedNavigation(
  sections: ContentSection[],
  categories: NavigationCategory[]
): CategorizedNavigationItem[] {
  if (categories.length === 0) {
    // Fallback to original navigation structure
    const navigation: NavigationItem[] = [];
    const navigationMap = new Map<string, NavigationItem>();

    for (const section of sections) {
      const navItem: NavigationItem = {
        slug: section.slug,
        title: section.title,
        level: section.level,
        parent: section.parent,
        order: section.order,
        children: [],
      };

      navigationMap.set(section.slug, navItem);

      if (section.parent && navigationMap.has(section.parent)) {
        const parent = navigationMap.get(section.parent)!;
        if (!parent.children) parent.children = [];
        parent.children.push(navItem);
      } else {
        navigation.push(navItem);
      }
    }

    return navigation.map((item) => ({
      type: "section" as const,
      slug: item.slug,
      title: item.title,
      level: item.level,
      parent: item.parent,
      order: item.order,
      children: item.children?.map((child) => ({
        type: "section" as const,
        slug: child.slug,
        title: child.title,
        level: child.level,
        parent: child.parent,
        order: child.order,
        children: child.children?.map((grandchild) => ({
          type: "section" as const,
          slug: grandchild.slug,
          title: grandchild.title,
          level: grandchild.level,
          parent: grandchild.parent,
          order: grandchild.order,
          children: [],
        })),
      })),
    }));
  }

  // Create categorized navigation
  const categorizedNav: CategorizedNavigationItem[] = [];
  const sectionMap = new Map<string, ContentSection[]>();

  // Group sections by their base filename (category)
  for (const section of sections) {
    const key = section.category;
    if (!sectionMap.has(key)) {
      sectionMap.set(key, []);
    }
    sectionMap.get(key)!.push(section);
  }

  // Categories are already in the correct order from the array
  for (let i = 0; i < categories.length; i++) {
    const category = categories[i];
    const categoryItem: CategorizedNavigationItem = {
      type: "category",
      name: category.name,
      slug: generateCategorySlug(category.name),
      order: i,
      children: [],
    };

    // Add sections for this category in the specified order
    for (const sectionKey of category.sections) {
      const sectionsForKey = sectionMap.get(
        sectionKey.replace(/_/g, " ").replace(/,/g, " &")
      );
      if (sectionsForKey) {
        // Create navigation tree for this section group
        const navigationMap = new Map<string, CategorizedNavigationItem>();

        for (const section of sectionsForKey) {
          const navItem: CategorizedNavigationItem = {
            type: "section",
            slug: section.slug,
            title: section.title,
            level: section.level,
            parent: section.parent,
            order: section.order,
            children: [],
          };

          navigationMap.set(section.slug, navItem);

          if (section.parent && navigationMap.has(section.parent)) {
            const parent = navigationMap.get(section.parent)!;
            if (!parent.children) parent.children = [];
            parent.children.push(navItem);
          } else {
            categoryItem.children!.push(navItem);
          }
        }
      }
    }

    if (categoryItem.children!.length > 0) {
      categorizedNav.push(categoryItem);
    }
  }

  // Add any uncategorized sections
  const categorizedSectionKeys = new Set(
    categories.flatMap((cat) =>
      cat.sections.map((s) => s.replace(/_/g, " ").replace(/,/g, " &"))
    )
  );

  const uncategorizedSections = sections.filter(
    (section) => !categorizedSectionKeys.has(section.category)
  );

  if (uncategorizedSections.length > 0) {
    const uncategorizedItem: CategorizedNavigationItem = {
      type: "category",
      name: "Other",
      order: 999,
      children: [],
    };

    const navigationMap = new Map<string, CategorizedNavigationItem>();

    for (const section of uncategorizedSections) {
      const navItem: CategorizedNavigationItem = {
        type: "section",
        slug: section.slug,
        title: section.title,
        level: section.level,
        parent: section.parent,
        order: section.order,
        children: [],
      };

      navigationMap.set(section.slug, navItem);

      if (section.parent && navigationMap.has(section.parent)) {
        const parent = navigationMap.get(section.parent)!;
        if (!parent.children) parent.children = [];
        parent.children.push(navItem);
      } else {
        uncategorizedItem.children!.push(navItem);
      }
    }

    categorizedNav.push(uncategorizedItem);
  }

  return categorizedNav;
}