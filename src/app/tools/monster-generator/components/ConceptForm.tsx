import React from "react";

interface ConceptFormProps {
  concept: string;
  setConcept: (concept: string) => void;
  loading: boolean;
  error: string | null;
  onSubmit: () => void;
}

export function ConceptForm({
  concept,
  setConcept,
  loading,
  error,
  onSubmit,
}: ConceptFormProps) {
  return (
    <section className="space-y-6" aria-labelledby="input-heading">
      <article className="bg-card border border-border rounded-lg p-6">
        <h2 id="input-heading" className="text-xl font-semibold mb-4">
          Monster Concept
        </h2>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <div>
            <label htmlFor="concept" className="block text-sm font-medium mb-2">
              Describe your monster
            </label>
            <textarea
              id="concept"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  if (!loading && concept.trim()) {
                    onSubmit();
                  }
                }
              }}
              placeholder="A shadowy wolf that can phase through walls, hunting in abandoned buildings... (Cmd+Enter to submit)"
              className="w-full h-32 px-3 py-2 border border-border rounded-md bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              disabled={loading}
              aria-describedby={error ? "concept-error" : "concept-help"}
              required
            />
          </div>
          {error && (
            <div
              id="concept-error"
              role="alert"
              className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm"
            >
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || !concept.trim()}
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-describedby="generate-help"
          >
            {loading ? "Generating Monster..." : "Generate Monster"}
          </button>
          <p id="concept-help" className="sr-only">
            Describe the monster you want to create, including its abilities,
            behavior, and role in combat.
          </p>
          <p id="generate-help" className="sr-only">
            Click to generate a monster stat block based on your description.
          </p>
        </form>
      </article>
    </section>
  );
}