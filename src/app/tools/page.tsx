import Link from "next/link";

export default function ToolsPage() {
  const tools = [
    {
      id: "monster-generator",
      title: "Monster Generator",
      description:
        "Generate custom monster stat blocks using AI. Perfect for creating unique enemies for your Heart Rush campaigns.",
      href: "/tools/monster-generator",
      icon: (
        <svg
          className="w-8 h-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      status: "available" as const,
    },
    {
      id: "character-sheet",
      title: "Character Sheet",
      description:
        "Access the official Heart Rush character sheet template. Track your character's stats, abilities, and equipment in Google Sheets.",
      href: "https://docs.google.com/spreadsheets/d/1LaB8VcwgbskMt2Sdh6WKEKal1QRyPspl3WE1eHeL4ZU/edit?gid=0#gid=0",
      icon: (
        <svg
          className="w-8 h-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
      status: "available" as const,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-4">
            GM Tools
          </h1>
          <p className="text-muted-foreground text-lg">
            A collection of tools to help Game Masters create and manage their
            Heart Rush campaigns.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool) => {
            const isExternal = tool.href.startsWith("http");
            const Component = isExternal ? "a" : Link;
            const linkProps = isExternal
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {};

            return (
              <Component
                key={tool.id}
                href={tool.href}
                {...linkProps}
                className="group block p-6 bg-card border border-border rounded-lg hover:border-primary/50 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 p-3 bg-primary/10 rounded-lg text-primary group-hover:bg-primary/20 transition-colors">
                    {tool.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors mb-2">
                      {tool.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {tool.description}
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent/20 text-accent-foreground">
                        {tool.status === "available"
                          ? "Available"
                          : "Coming Soon"}
                      </span>
                      <svg
                        className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </Component>
            );
          })}
        </div>
      </div>
    </div>
  );
}
