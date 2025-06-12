"use client";

import Link from "next/link";
import React, { useState } from "react";
import { MonsterStatBlock as MonsterStatBlockType } from "./types";
import { copyToClipboard } from "./utils";
import { generateMarkdown } from "./markdown";
import { MonsterStatBlock } from "./components/MonsterStatBlock";
import { ConceptForm } from "./components/ConceptForm";
import { TipsSection, ExamplesSection, EmptyState } from "./components/HelpSections";

export default function MonsterGeneratorPage() {
  const [concept, setConcept] = useState("");
  const [loading, setLoading] = useState(false);
  const [monster, setMonster] = useState<MonsterStatBlockType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateMonster = async () => {
    if (!concept.trim()) {
      setError("Please enter a monster concept");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/generate-monster", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ concept }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate monster: ${response.statusText}`);
      }

      const data = await response.json();
      setMonster(data.object);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate monster"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (monster) {
      copyToClipboard(generateMarkdown(monster), setCopied);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <header className="mb-8">
          <nav
            className="flex items-center space-x-2 text-sm text-muted-foreground mb-4"
            aria-label="Breadcrumb"
          >
            <Link
              href="/tools"
              className="hover:text-primary transition-colors"
            >
              GM Tools
            </Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Monster Generator</span>
          </nav>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-4">
            Monster Generator
          </h1>
          <p className="text-muted-foreground text-lg">
            Generate custom monster stat blocks using AI. Create everything from
            simple minions to complex multi-part bosses with environmental
            effects and tactical depth.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <ConceptForm
              concept={concept}
              setConcept={setConcept}
              loading={loading}
              error={error}
              onSubmit={generateMonster}
            />
            <TipsSection />
            <ExamplesSection />
          </div>

          <section className="space-y-6" aria-labelledby="output-heading">
            {monster && (
              <MonsterStatBlock
                monster={monster}
                copied={copied}
                onCopy={handleCopy}
              />
            )}

            {!monster && !loading && <EmptyState />}
          </section>
        </div>
      </div>
    </main>
  );
}