import Link from "next/link";
import { getNavigationTree } from "../lib/content";
import { PDFDownloadButton } from "../components/PDFDownloadButton";

export default async function HomePage() {
  const navigation = await getNavigationTree();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <header className="text-center mb-12">
        <h1 className="text-4xl font-bold text-foreground mb-4">
          Heart Rush Digital Rulebook
        </h1>
        <p className="text-xl text-muted-foreground mb-2">
          Welcome to the official digital rulebook for Heart Rush TTRPG
        </p>
        <p className="text-muted-foreground mb-6">
          Navigate through {navigation.length} sections of rules, lore, and
          gameplay guidance
        </p>
        <div className="flex justify-center">
          <PDFDownloadButton />
        </div>
      </header>

      {/* Featured Sections */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-foreground mb-6">
          Featured Sections
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Getting Started */}
          <div className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-all duration-200 hover:border-primary/30">
            <h3 className="text-xl font-semibold text-card-foreground mb-3">
              Getting Started
            </h3>
            <p className="text-muted-foreground mb-4">
              Everything you need to create your first character and start
              playing
            </p>
            <div className="flex flex-col items-center gap-4 mt-10">
              <Link
                href="/a-brief-intro"
                className="inline-block bg-secondary text-secondary-foreground px-4 py-2 rounded-full hover:bg-secondary/90 transition-colors w-full text-center"
              >
                Intro to Heart Rush
              </Link>
              <Link
                href="/category/character-creation"
                className="inline-block bg-primary text-primary-foreground px-4 py-2 rounded-full hover:bg-primary/90 transition-colors w-full text-center"
              >
                Start Building →
              </Link>
              <a
                href="https://docs.google.com/spreadsheets/d/1LaB8VcwgbskMt2Sdh6WKEKal1QRyPspl3WE1eHeL4ZU/edit?gid=0#gid=0"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-accent text-accent-foreground px-4 py-2 rounded-full hover:bg-accent/90 transition-colors w-full text-center"
              >
                Character Sheet →
              </a>
            </div>
          </div>

          {/* Leveling Up */}
          <div className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-all duration-200 hover:border-primary/30">
            <h3 className="text-xl font-semibold text-card-foreground mb-3">
              Leveling Up
            </h3>
            <p className="text-muted-foreground mb-4">
              Advance your character through classes, talents, and experience
            </p>
            <div className="space-y-2">
              <Link
                href="/classes"
                className="block text-primary hover:text-secondary hover:underline text-sm transition-colors"
              >
                Classes
              </Link>
              <Link
                href="/talents"
                className="block text-primary hover:text-secondary hover:underline text-sm transition-colors"
              >
                Talents
              </Link>
              <Link
                href="/paragon-abilities"
                className="block text-primary hover:text-secondary hover:underline text-sm transition-colors"
              >
                Paragon Abilities
              </Link>
              <Link
                href="/spells"
                className="block text-primary hover:text-secondary hover:underline text-sm transition-colors"
              >
                Spells
              </Link>
              <Link
                href="/experience-1"
                className="block text-primary hover:text-secondary hover:underline text-sm transition-colors"
              >
                Experience
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* All Sections */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-foreground mb-6">
          All Sections
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {navigation.filter(section => section.slug).map((section) => (
            <Link
              key={section.slug || section.name}
              href={section.type === 'category' ? `/category/${section.slug}` : `/${section.slug}`}
              className="block bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-all duration-200 hover:border-primary/30"
            >
              <h3 className="text-lg font-semibold text-card-foreground mb-3">
                {section.title || section.name}
              </h3>

              {section.children && section.children.length > 0 && (
                <ul className="space-y-2 mb-4">
                  {section.children.slice(0, 3).map((child) => (
                    <li key={child.slug}>
                      <span className="text-primary text-sm transition-colors">
                        {child.title}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <span className="inline-block text-muted-foreground text-sm font-medium transition-colors">
                Explore {section.title || section.name} →
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
