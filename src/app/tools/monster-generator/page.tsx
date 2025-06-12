"use client";

import { useState } from "react";
import Link from "next/link";

interface MonsterStatBlock {
  name: string;
  subtitle?: string;
  size: "S" | "M" | "L" | "L2" | "L3" | "L4" | "L5";
  abilities: {
    might: "4" | "6" | "8" | "10" | "12" | "20";
    agility: "4" | "6" | "8" | "10" | "12" | "20";
    cunning: "4" | "6" | "8" | "10" | "12" | "20";
    presence: "4" | "6" | "8" | "10" | "12" | "20";
  };
  heartDie: "d4" | "d6" | "d8" | "d10" | "d12" | "d20";
  defenseBonus: number;
  attackBonus: number;
  hitPoints: number;
  woundThreshold: number;
  specialAbilities: string[];
  advantages?: string[];
  disadvantages?: string[];
  isComplex: boolean;
  solution?: string;
  complications?: string;
  mechanic?: string;
  components?: Array<{
    name: string;
    size: "S" | "M" | "L" | "L2" | "L3" | "L4" | "L5";
    abilities: {
      might: "4" | "6" | "8" | "10" | "12" | "20";
      agility: "4" | "6" | "8" | "10" | "12" | "20";
      cunning: "4" | "6" | "8" | "10" | "12" | "20";
      presence: "4" | "6" | "8" | "10" | "12" | "20";
    };
    heartDie: "d4" | "d6" | "d8" | "d10" | "d12" | "d20";
    defenseBonus: number;
    attackBonus: number;
    hitPoints: number;
    woundThreshold: number;
    specialAbilities: string[];
  }>;
}

export default function MonsterGeneratorPage() {
  const [concept, setConcept] = useState("");
  const [loading, setLoading] = useState(false);
  const [monster, setMonster] = useState<MonsterStatBlock | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      setError(err instanceof Error ? err.message : "Failed to generate monster");
    } finally {
      setLoading(false);
    }
  };

  const generateMarkdown = (monster: MonsterStatBlock) => {
    let markdown: string;
    
    if (monster.isComplex && monster.components && monster.components.length > 0) {
      // Complex monster with components
      markdown = `### ${monster.name}\n`;
      if (monster.subtitle) markdown += `*${monster.subtitle}*\n`;
      
      if (monster.solution) markdown += `**Solution**: ${monster.solution}\n`;
      if (monster.complications) markdown += `**Complications**: ${monster.complications}\n`;
      if (monster.mechanic) markdown += `**Mechanic**: ${monster.mechanic}\n\n`;
      
      markdown += `#### Stats\n##### Components\n`;
      
      monster.components.forEach(component => {
        markdown += `###### ${component.name}\n`;
        markdown += `**Size**: ${component.size}\n`;
        markdown += `${component.abilities.might}/${component.abilities.agility}/${component.abilities.cunning}/${component.abilities.presence} **HD** ${component.heartDie} **D** +${component.defenseBonus} **A** +${component.attackBonus} **HP** ${component.hitPoints} w ${component.woundThreshold}\n`;
        component.specialAbilities.forEach(ability => {
          markdown += `- ${ability}\n`;
        });
        markdown += `\n`;
      });
    } else {
      // Simple monster
      markdown = `#### ${monster.name}\n`;
      if (monster.subtitle) markdown += `*${monster.subtitle}*\n`;
      markdown += `**Size**: ${monster.size}\n`;
      markdown += `${monster.abilities.might}/${monster.abilities.agility}/${monster.abilities.cunning}/${monster.abilities.presence} **HD** ${monster.heartDie} **D** +${monster.defenseBonus} **A** +${monster.attackBonus} **HP** ${monster.hitPoints} w ${monster.woundThreshold}\n`;
      
      monster.specialAbilities.forEach(ability => {
        markdown += `- ${ability}\n`;
      });
      
      if (monster.advantages && monster.advantages.length > 0) {
        markdown += `\n**Advantages**: ${monster.advantages.join(', ')}\n`;
      }
      if (monster.disadvantages && monster.disadvantages.length > 0) {
        markdown += `**Disadvantages**: ${monster.disadvantages.join(', ')}\n`;
      }
    }
    
    return markdown;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-4">
            <Link href="/tools" className="hover:text-primary transition-colors">
              GM Tools
            </Link>
            <span>/</span>
            <span>Monster Generator</span>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-4">
            Monster Generator
          </h1>
          <p className="text-muted-foreground text-lg">
            Generate custom monster stat blocks using AI. Describe your monster concept and get a complete stat block ready for your Heart Rush campaign.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Monster Concept</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="concept" className="block text-sm font-medium mb-2">
                    Describe your monster
                  </label>
                  <textarea
                    id="concept"
                    value={concept}
                    onChange={(e) => setConcept(e.target.value)}
                    placeholder="A shadowy wolf that can phase through walls, hunting in abandoned buildings..."
                    className="w-full h-32 px-3 py-2 border border-border rounded-md bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={loading}
                  />
                </div>
                {error && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
                    {error}
                  </div>
                )}
                <button
                  onClick={generateMonster}
                  disabled={loading || !concept.trim()}
                  className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? "Generating Monster..." : "Generate Monster"}
                </button>
              </div>
            </div>

            {/* Tips */}
            <div className="bg-muted/30 border border-border/50 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-3">Tips for Better Results</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start space-x-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Be specific about the monster's abilities and behavior</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Mention the intended challenge level or environment</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Include unique traits that make it interesting in combat</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Consider its role in your story or encounter</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Output Section */}
          <div className="space-y-6">
            {monster && (
              <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">Generated Monster</h2>
                  <button
                    onClick={() => copyToClipboard(generateMarkdown(monster))}
                    className="px-3 py-1 text-sm bg-muted hover:bg-muted/80 rounded-md transition-colors"
                  >
                    Copy Markdown
                  </button>
                </div>
                <div className="space-y-4 text-sm">
                  <div>
                    <h3 className="text-2xl font-bold">{monster.name}</h3>
                    {monster.subtitle && (
                      <p className="text-muted-foreground italic">{monster.subtitle}</p>
                    )}
                    <p className="text-muted-foreground">
                      <strong>Size:</strong> {monster.size}
                    </p>
                  </div>

                  {monster.isComplex && (
                    <div className="space-y-2 p-3 bg-muted/20 rounded-md">
                      {monster.solution && (
                        <div><strong>Solution:</strong> {monster.solution}</div>
                      )}
                      {monster.complications && (
                        <div><strong>Complications:</strong> {monster.complications}</div>
                      )}
                      {monster.mechanic && (
                        <div><strong>Mechanic:</strong> {monster.mechanic}</div>
                      )}
                    </div>
                  )}

                  {monster.components && monster.components.length > 0 ? (
                    <div>
                      <h4 className="font-semibold mb-3">Components</h4>
                      {monster.components.map((component, index) => (
                        <div key={index} className="mb-4 p-3 border border-border rounded-md">
                          <h5 className="font-semibold text-base mb-2">{component.name}</h5>
                          <div className="space-y-2">
                            <div><strong>Size:</strong> {component.size}</div>
                            <div className="font-mono text-xs bg-muted p-2 rounded">
                              {component.abilities.might}/{component.abilities.agility}/{component.abilities.cunning}/{component.abilities.presence} <strong>HD</strong> {component.heartDie} <strong>D</strong> +{component.defenseBonus} <strong>A</strong> +{component.attackBonus} <strong>HP</strong> {component.hitPoints} w {component.woundThreshold}
                            </div>
                            {component.specialAbilities.length > 0 && (
                              <div>
                                <strong>Abilities:</strong>
                                <ul className="list-disc list-inside mt-1 space-y-1">
                                  {component.specialAbilities.map((ability, i) => (
                                    <li key={i}>{ability}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <div className="font-mono text-xs bg-muted p-2 rounded mb-3">
                        {monster.abilities.might}/{monster.abilities.agility}/{monster.abilities.cunning}/{monster.abilities.presence} <strong>HD</strong> {monster.heartDie} <strong>D</strong> +{monster.defenseBonus} <strong>A</strong> +{monster.attackBonus} <strong>HP</strong> {monster.hitPoints} w {monster.woundThreshold}
                      </div>

                      {monster.specialAbilities.length > 0 && (
                        <div className="mb-3">
                          <h4 className="font-semibold mb-2">Special Abilities</h4>
                          <ul className="list-disc list-inside space-y-1">
                            {monster.specialAbilities.map((ability, index) => (
                              <li key={index}>{ability}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {(monster.advantages && monster.advantages.length > 0) && (
                        <div className="mb-2">
                          <strong>Advantages:</strong> {monster.advantages.join(', ')}
                        </div>
                      )}

                      {(monster.disadvantages && monster.disadvantages.length > 0) && (
                        <div className="mb-2">
                          <strong>Disadvantages:</strong> {monster.disadvantages.join(', ')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {!monster && !loading && (
              <div className="bg-muted/30 border border-border/50 rounded-lg p-6 text-center">
                <svg className="w-12 h-12 mx-auto mb-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-muted-foreground">
                  Enter a monster concept to generate a stat block
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}