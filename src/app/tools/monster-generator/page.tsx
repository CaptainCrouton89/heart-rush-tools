"use client";

import { useState } from "react";
import Link from "next/link";

type Die = "d4" | "d6" | "d8" | "d10" | "d12" | "d20";
type Size = "S" | "M" | "L" | "L2" | "L3" | "L4" | "L5" | "L6" | "L7" | "L8";

interface Abilities {
  might: Die;
  agility: Die;
  cunning: Die;
  presence: Die;
}

interface ConditionalBonus {
  condition: string;
  bonus: number;
}

interface AttackDefense {
  base?: number;
  byDamageType?: {
    slashingPiercing?: number;
    bludgeoning?: number;
    other?: Record<string, number>;
  };
  conditional?: ConditionalBonus[];
}

interface Save {
  type: "MC" | "AC" | "CC" | "PC";
  dc: number;
}

interface SpecialAbility {
  name: string;
  description?: string;
  type?: "passive" | "triggered" | "action" | "reaction" | "aura";
  trigger?: string;
  uses?: string;
  range?: string;
  save?: Save;
  effect?: string;
  damage?: string;
  conditions?: Array<{
    name: string;
    levels?: number;
    duration?: string;
  }>;
}

interface Movement {
  cannotBePushed?: boolean;
  speed?: number;
  special?: string[];
}

interface Phase {
  trigger: string;
  changes: string[];
}

interface Aura {
  name: string;
  range: string;
  effect: string;
  save?: Save;
}

interface Mechanics {
  engagementsPerRound?: number;
  phases?: Phase[];
  auras?: Aura[];
}

interface BaseMonster {
  name: string;
  subtitle?: string;
  size: Size;
  abilities: Abilities;
  heartDie: Die;
  hp: number;
  woundThreshold: number | null;
  attack: number | AttackDefense;
  defense: number | AttackDefense;
  specialAbilities: (string | SpecialAbility)[];
  movement?: Movement;
  mechanics?: Mechanics;
  notes?: string;
}

interface Component extends BaseMonster {
  quantity?: number;
  shared?: boolean;
}

interface MonsterStatBlock extends BaseMonster {
  components?: Component[];
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

  const formatAttackDefense = (value: number | AttackDefense, prefix: string): JSX.Element => {
    if (typeof value === "number") {
      return <><strong>{prefix}</strong> +{value}</>;
    }
    
    const parts: JSX.Element[] = [];
    
    if (value.base !== undefined) {
      parts.push(<><strong>{prefix}</strong> +{value.base}</>);
    }
    
    if (value.byDamageType) {
      const typeParts = [];
      if (value.byDamageType.slashingPiercing !== undefined) {
        typeParts.push(`+${value.byDamageType.slashingPiercing}(s/p)`);
      }
      if (value.byDamageType.bludgeoning !== undefined) {
        typeParts.push(`+${value.byDamageType.bludgeoning}(b)`);
      }
      if (value.byDamageType.other) {
        Object.entries(value.byDamageType.other).forEach(([type, bonus]) => {
          typeParts.push(`+${bonus}(${type})`);
        });
      }
      if (typeParts.length > 0) {
        if (parts.length === 0) {
          parts.push(<><strong>{prefix}</strong> {typeParts.join(' ')}</>);
        } else {
          parts.push(<> {typeParts.join(' ')}</>);
        }
      }
    }
    
    return parts.length > 0 ? <>{parts}</> : <><strong>{prefix}</strong> +0</>;
  };

  const formatAttackDefenseMarkdown = (value: number | AttackDefense, prefix: string): string => {
    if (typeof value === "number") {
      return `**${prefix}** +${value}`;
    }
    
    let result = "";
    if (value.base !== undefined) {
      result = `**${prefix}** +${value.base}`;
    }
    
    if (value.byDamageType) {
      const parts = [];
      if (value.byDamageType.slashingPiercing !== undefined) {
        parts.push(`+${value.byDamageType.slashingPiercing}(s/p)`);
      }
      if (value.byDamageType.bludgeoning !== undefined) {
        parts.push(`+${value.byDamageType.bludgeoning}(b)`);
      }
      if (value.byDamageType.other) {
        Object.entries(value.byDamageType.other).forEach(([type, bonus]) => {
          parts.push(`+${bonus}(${type})`);
        });
      }
      if (parts.length > 0) {
        result = result ? `${result} ${parts.join(' ')}` : `**${prefix}** ${parts.join(' ')}`;
      }
    }
    
    return result || `**${prefix}** +0`;
  };

  const formatAbility = (ability: string | SpecialAbility): string => {
    if (typeof ability === "string") return ability;
    
    let result = ability.name;
    if (ability.uses) result += ` (${ability.uses})`;
    if (ability.range) result += ` [${ability.range}]`;
    if (ability.description || ability.effect) {
      const desc = ability.description || ability.effect || "";
      result += `: ${desc}`;
    }
    if (ability.save) {
      result += ` (${ability.save.type}${ability.save.dc})`;
    }
    if (ability.damage) {
      result += ` [${ability.damage} damage]`;
    }
    return result;
  };

  const generateMarkdown = (monster: MonsterStatBlock) => {
    let markdown: string;
    
    if (monster.components && monster.components.length > 0) {
      // Multi-part monster
      markdown = `### ${monster.name}\n`;
      if (monster.subtitle) markdown += `*${monster.subtitle}*\n\n`;
      
      if (monster.notes) markdown += `${monster.notes}\n\n`;
      
      if (monster.mechanics?.auras && monster.mechanics.auras.length > 0) {
        markdown += `**Environmental Effects:**\n`;
        monster.mechanics.auras.forEach(aura => {
          markdown += `- **${aura.name}** (${aura.range}): ${aura.effect}\n`;
        });
        markdown += `\n`;
      }
      
      markdown += `#### Components\n`;
      
      monster.components.forEach(component => {
        markdown += `##### ${component.name}`;
        if (component.quantity && component.quantity > 1) {
          markdown += ` (x${component.quantity})`;
        }
        markdown += `\n`;
        
        markdown += `**Size**: ${component.size}`;
        if (component.movement?.cannotBePushed) {
          markdown += ". Cannot be Pushed";
        }
        markdown += `.\n`;
        
        const attackStr = formatAttackDefenseMarkdown(component.attack, "A");
        const defenseStr = formatAttackDefenseMarkdown(component.defense, "D");
        const woundStr = component.woundThreshold === null ? "/" : component.woundThreshold;
        
        markdown += `${component.abilities.might}/${component.abilities.agility}/${component.abilities.cunning}/${component.abilities.presence} **HD** ${component.heartDie} **HP** ${component.hp} **w** ${woundStr}\n`;
        markdown += `${attackStr} ${defenseStr}\n`;
        
        component.specialAbilities.forEach(ability => {
          markdown += `- ${formatAbility(ability)}\n`;
        });
        markdown += `\n`;
      });
    } else {
      // Single monster
      markdown = `#### ${monster.name}\n`;
      if (monster.subtitle) markdown += `*${monster.subtitle}*\n`;
      
      markdown += `**Size**: ${monster.size}`;
      if (monster.movement?.cannotBePushed) {
        markdown += ". Cannot be Pushed";
      }
      markdown += `\n`;
      
      const attackStr = formatAttackDefenseMarkdown(monster.attack, "A");
      const defenseStr = formatAttackDefenseMarkdown(monster.defense, "D");
      const woundStr = monster.woundThreshold === null ? "/" : monster.woundThreshold;
      
      markdown += `${monster.abilities.might}/${monster.abilities.agility}/${monster.abilities.cunning}/${monster.abilities.presence} **HD** ${monster.heartDie} **HP** ${monster.hp} **w** ${woundStr}\n`;
      markdown += `${attackStr} ${defenseStr}\n`;
      
      if (monster.mechanics?.engagementsPerRound && monster.mechanics.engagementsPerRound > 1) {
        markdown += `Engage ${monster.mechanics.engagementsPerRound}x a round\n`;
      }
      
      monster.specialAbilities.forEach(ability => {
        markdown += `- ${formatAbility(ability)}\n`;
      });
      
      if (monster.notes) {
        markdown += `\n**Notes**: ${monster.notes}\n`;
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
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <header className="mb-8">
          <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-4" aria-label="Breadcrumb">
            <Link href="/tools" className="hover:text-primary transition-colors">
              GM Tools
            </Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Monster Generator</span>
          </nav>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-4">
            Monster Generator
          </h1>
          <p className="text-muted-foreground text-lg">
            Generate custom monster stat blocks using AI. Create everything from simple minions to complex multi-part bosses with environmental effects and tactical depth.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <section className="space-y-6" aria-labelledby="input-heading">
            <article className="bg-card border border-border rounded-lg p-6">
              <h2 id="input-heading" className="text-xl font-semibold mb-4">Monster Concept</h2>
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); generateMonster(); }}>
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
                    aria-describedby={error ? "concept-error" : "concept-help"}
                    required
                  />
                </div>
                {error && (
                  <div id="concept-error" role="alert" className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
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
                  Describe the monster you want to create, including its abilities, behavior, and role in combat.
                </p>
                <p id="generate-help" className="sr-only">
                  Click to generate a monster stat block based on your description.
                </p>
              </form>
            </article>

            {/* Tips */}
            <aside className="bg-muted/30 border border-border/50 rounded-lg p-6" aria-labelledby="tips-heading">
              <h3 id="tips-heading" className="text-lg font-semibold mb-3">Tips for Better Results</h3>
              <ul className="space-y-2 text-sm text-muted-foreground" role="list">
                <li className="flex items-start space-x-2">
                  <span className="text-primary mt-1" aria-hidden="true">•</span>
                  <span>Be specific about the monster's abilities and behavior</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-primary mt-1" aria-hidden="true">•</span>
                  <span>Mention the intended challenge level (minion, standard, elite, boss)</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-primary mt-1" aria-hidden="true">•</span>
                  <span>Include unique traits that make it tactically interesting</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-primary mt-1" aria-hidden="true">•</span>
                  <span>For complex monsters, describe component relationships</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-primary mt-1" aria-hidden="true">•</span>
                  <span>Consider its role in your story or encounter</span>
                </li>
              </ul>
            </aside>
            
            <aside className="bg-accent/10 border border-accent/20 rounded-lg p-6" aria-labelledby="examples-heading">
              <h3 id="examples-heading" className="text-lg font-semibold mb-3 text-accent-foreground">Example Concepts</h3>
              <dl className="space-y-2 text-sm text-muted-foreground">
                <div><dt className="inline font-bold">Simple:</dt> <dd className="inline">"A pack of spectral wolves that phase through walls"</dd></div>
                <div><dt className="inline font-bold">Elite:</dt> <dd className="inline">"A corrupted tree that controls vines and spreads poison spores"</dd></div>
                <div><dt className="inline font-bold">Boss:</dt> <dd className="inline">"An ancient lich with multiple phylacteries hidden around the battlefield"</dd></div>
                <div><dt className="inline font-bold">Multi-part:</dt> <dd className="inline">"A massive spider with destructible legs and a vulnerable core"</dd></div>
              </dl>
            </aside>
          </section>

          {/* Output Section */}
          <section className="space-y-6" aria-labelledby="output-heading">
            {monster && (
              <article className="bg-card border border-border rounded-lg p-6">
                <header className="flex items-center justify-between mb-4">
                  <h2 id="output-heading" className="text-xl font-semibold">Generated Monster</h2>
                  <button
                    onClick={() => copyToClipboard(generateMarkdown(monster))}
                    className="px-3 py-1 text-sm bg-muted hover:bg-muted/80 rounded-md transition-colors"
                    aria-label="Copy monster stat block as markdown text"
                  >
                    Copy Markdown
                  </button>
                </header>
                <div className="space-y-4 text-sm">
                  <header>
                    <h3 className="text-2xl font-bold">{monster.name}</h3>
                    {monster.subtitle && (
                      <p className="text-muted-foreground italic">{monster.subtitle}</p>
                    )}
                    <dl className="text-muted-foreground">
                      <dt className="inline font-bold">Size:</dt> <dd className="inline">{monster.size}</dd>
                    </dl>
                  </header>

                  {monster.notes && (
                    <aside className="p-3 bg-muted/20 rounded-md" aria-labelledby="notes-heading">
                      <h4 id="notes-heading" className="font-bold inline">Notes:</h4> <span>{monster.notes}</span>
                    </aside>
                  )}
                  
                  {monster.mechanics?.engagementsPerRound && monster.mechanics.engagementsPerRound > 1 && (
                    <aside className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-md text-sm" aria-labelledby="engagements-heading">
                      <h4 id="engagements-heading" className="font-bold inline">Engagements:</h4> <span>{monster.mechanics.engagementsPerRound}x per round</span>
                    </aside>
                  )}
                  
                  {monster.mechanics?.auras && monster.mechanics.auras.length > 0 && (
                    <aside className="p-3 bg-red-100 dark:bg-red-900/20 rounded-md" aria-labelledby="environmental-heading">
                      <h4 id="environmental-heading" className="font-bold">Environmental Effects:</h4>
                      <ul className="list-disc list-inside mt-1 space-y-1" role="list">
                        {monster.mechanics.auras.map((aura, i) => (
                          <li key={i}><strong>{aura.name}</strong> ({aura.range}): {aura.effect}</li>
                        ))}
                      </ul>
                    </aside>
                  )}

                  {monster.components && monster.components.length > 0 ? (
                    <section aria-labelledby="components-heading">
                      <h4 id="components-heading" className="font-semibold mb-3">Components</h4>
                      {monster.components.map((component, index) => (
                        <article key={index} className="mb-4 p-3 border border-border rounded-md">
                          <header className="mb-2">
                            <h5 className="font-semibold text-base">
                              {component.name}
                              {component.quantity && component.quantity > 1 && (
                                <span className="text-sm font-normal text-muted-foreground ml-2" aria-label={`quantity ${component.quantity}`}>(x{component.quantity})</span>
                              )}
                            </h5>
                          </header>
                          <div className="space-y-2">
                            <dl>
                              <dt className="inline font-bold">Size:</dt> 
                              <dd className="inline">
                                {component.size}
                                {component.movement?.cannotBePushed && (
                                  <span className="text-sm text-muted-foreground ml-2">• Cannot be Pushed</span>
                                )}
                              </dd>
                            </dl>
                            <div className="font-mono text-xs bg-muted p-2 rounded" role="img" aria-label={`Stats: Might ${component.abilities.might}, Agility ${component.abilities.agility}, Cunning ${component.abilities.cunning}, Presence ${component.abilities.presence}, Heart Die ${component.heartDie}, ${component.hp} hit points, wound threshold ${component.woundThreshold === null ? "none" : component.woundThreshold}`}>
                              {component.abilities.might}/{component.abilities.agility}/{component.abilities.cunning}/{component.abilities.presence} <strong>HD</strong> {component.heartDie} <strong>HP</strong> {component.hp} <strong>w</strong> {component.woundThreshold === null ? "/" : component.woundThreshold}
                              <br />
                              {formatAttackDefense(component.attack, "A")} {formatAttackDefense(component.defense, "D")}
                            </div>
                            {component.specialAbilities.length > 0 && (
                              <section aria-labelledby={`abilities-${index}-heading`}>
                                <h6 id={`abilities-${index}-heading`} className="font-bold">Abilities:</h6>
                                <ul className="list-disc list-inside mt-1 space-y-1" role="list">
                                  {component.specialAbilities.map((ability, i) => (
                                    <li key={i}>{formatAbility(ability)}</li>
                                  ))}
                                </ul>
                              </section>
                            )}
                          </div>
                        </article>
                      ))}
                    </section>
                  ) : (
                    <section>
                      <div className="font-mono text-xs bg-muted p-2 rounded mb-3" role="img" aria-label={`Monster stats: Might ${monster.abilities.might}, Agility ${monster.abilities.agility}, Cunning ${monster.abilities.cunning}, Presence ${monster.abilities.presence}, Heart Die ${monster.heartDie}, ${monster.hp} hit points, wound threshold ${monster.woundThreshold === null ? "none" : monster.woundThreshold}`}>
                        {monster.abilities.might}/{monster.abilities.agility}/{monster.abilities.cunning}/{monster.abilities.presence} <strong>HD</strong> {monster.heartDie} <strong>HP</strong> {monster.hp} <strong>w</strong> {monster.woundThreshold === null ? "/" : monster.woundThreshold}
                        <br />
                        {formatAttackDefense(monster.attack, "A")} {formatAttackDefense(monster.defense, "D")}
                      </div>

                      {monster.specialAbilities.length > 0 && (
                        <section className="mb-3" aria-labelledby="abilities-heading">
                          <h4 id="abilities-heading" className="font-semibold mb-2">Special Abilities</h4>
                          <ul className="list-disc list-inside space-y-1" role="list">
                            {monster.specialAbilities.map((ability, index) => (
                              <li key={index}>{formatAbility(ability)}</li>
                            ))}
                          </ul>
                        </section>
                      )}

                      {monster.movement && (
                        <aside className="mb-2" aria-labelledby="movement-heading">
                          <h4 id="movement-heading" className="font-bold inline">Movement:</h4>
                          <span>
                            {monster.movement.cannotBePushed && " Cannot be Pushed"}
                            {monster.movement.speed && ` Speed ${monster.movement.speed}`}
                            {monster.movement.special && ` (${monster.movement.special.join(", ")})`}
                          </span>
                        </aside>
                      )}
                      
                      {monster.mechanics?.phases && monster.mechanics.phases.length > 0 && (
                        <aside className="mb-2" aria-labelledby="phases-heading">
                          <h4 id="phases-heading" className="font-bold">Phases:</h4>
                          <ul className="list-disc list-inside mt-1" role="list">
                            {monster.mechanics.phases.map((phase, i) => (
                              <li key={i}><em>{phase.trigger}:</em> {phase.changes.join("; ")}</li>
                            ))}
                          </ul>
                        </aside>
                      )}
                    </section>
                  )}
                </div>
              </article>
            )}

            {!monster && !loading && (
              <div className="bg-muted/30 border border-border/50 rounded-lg p-6 text-center" role="status" aria-live="polite">
                <svg className="w-12 h-12 mx-auto mb-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-muted-foreground">
                  Enter a monster concept to generate a stat block
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}