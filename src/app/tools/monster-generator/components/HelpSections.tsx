import React from "react";

export function TipsSection() {
  return (
    <aside
      className="bg-muted/30 border border-border/50 rounded-lg p-6"
      aria-labelledby="tips-heading"
    >
      <h3 id="tips-heading" className="text-lg font-semibold mb-3">
        Tips for Better Results
      </h3>
      <ul className="space-y-2 text-sm text-muted-foreground" role="list">
        <li className="flex items-start space-x-2">
          <span className="text-primary mt-1" aria-hidden="true">
            •
          </span>
          <span>Be specific about the monster's abilities and behavior</span>
        </li>
        <li className="flex items-start space-x-2">
          <span className="text-primary mt-1" aria-hidden="true">
            •
          </span>
          <span>
            Mention the intended challenge level (minion, standard, elite, boss)
          </span>
        </li>
        <li className="flex items-start space-x-2">
          <span className="text-primary mt-1" aria-hidden="true">
            •
          </span>
          <span>Include unique traits that make it tactically interesting</span>
        </li>
        <li className="flex items-start space-x-2">
          <span className="text-primary mt-1" aria-hidden="true">
            •
          </span>
          <span>For complex monsters, describe component relationships</span>
        </li>
        <li className="flex items-start space-x-2">
          <span className="text-primary mt-1" aria-hidden="true">
            •
          </span>
          <span>Consider its role in your story or encounter</span>
        </li>
      </ul>
    </aside>
  );
}

export function ExamplesSection() {
  return (
    <aside
      className="bg-accent/10 border border-accent/20 rounded-lg p-6"
      aria-labelledby="examples-heading"
    >
      <h3
        id="examples-heading"
        className="text-lg font-semibold mb-3 text-accent-foreground"
      >
        Example Concepts
      </h3>
      <dl className="space-y-2 text-sm text-muted-foreground">
        <div>
          <dt className="inline font-bold">Simple:</dt>{" "}
          <dd className="inline">
            "A pack of spectral wolves that phase through walls"
          </dd>
        </div>
        <div>
          <dt className="inline font-bold">Elite:</dt>{" "}
          <dd className="inline">
            "A corrupted tree that controls vines and spreads poison spores"
          </dd>
        </div>
        <div>
          <dt className="inline font-bold">Boss:</dt>{" "}
          <dd className="inline">
            "An ancient lich with multiple phylacteries hidden around the
            battlefield"
          </dd>
        </div>
        <div>
          <dt className="inline font-bold">Multi-part:</dt>{" "}
          <dd className="inline">
            "A massive spider with destructible legs and a vulnerable core"
          </dd>
        </div>
      </dl>
    </aside>
  );
}

export function EmptyState() {
  return (
    <div
      className="bg-muted/30 border border-border/50 rounded-lg p-6 text-center"
      role="status"
      aria-live="polite"
    >
      <svg
        className="w-12 h-12 mx-auto mb-4 text-muted-foreground"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <p className="text-muted-foreground">
        Enter a monster concept to generate a stat block
      </p>
    </div>
  );
}