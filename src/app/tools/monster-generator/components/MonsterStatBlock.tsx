import React from "react";
import { MonsterStatBlock as MonsterStatBlockType } from "../types";
import { formatAttackDefense, formatAbility } from "../utils";

interface MonsterStatBlockProps {
  monster: MonsterStatBlockType;
  copied: boolean;
  onCopy: () => void;
}

export function MonsterStatBlock({ monster, copied, onCopy }: MonsterStatBlockProps) {
  return (
    <article className="bg-card border border-border rounded-lg p-6">
      <header className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Generated Monster</h2>
        <button
          onClick={() => onCopy()}
          className="px-3 py-1 text-sm bg-muted hover:bg-muted/80 rounded-md transition-colors cursor-pointer"
          aria-label="Copy monster stat block as markdown text"
        >
          {copied ? "Copied!" : "Copy Markdown"}
        </button>
      </header>
      <div className="space-y-4 text-sm">
        <header>
          <h3 className="text-2xl font-bold">{monster.name}</h3>
          {monster.subtitle && (
            <p className="text-muted-foreground italic">{monster.subtitle}</p>
          )}
          <dl className="text-muted-foreground">
            <dt className="inline font-bold">Size:</dt>{" "}
            <dd className="inline">{monster.size}</dd>
          </dl>
        </header>

        {monster.notes && (
          <aside
            className="p-3 bg-muted/20 rounded-md"
            aria-labelledby="notes-heading"
          >
            <h4 id="notes-heading" className="font-bold inline">
              Notes:
            </h4>{" "}
            <span>{monster.notes}</span>
          </aside>
        )}

        {monster.mechanics?.engagementsPerRound &&
          monster.mechanics.engagementsPerRound > 1 && (
            <aside
              className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-md text-sm"
              aria-labelledby="engagements-heading"
            >
              <h4 id="engagements-heading" className="font-bold inline">
                Engagements:
              </h4>{" "}
              <span>{monster.mechanics.engagementsPerRound}x per round</span>
            </aside>
          )}

        {monster.mechanics?.auras && monster.mechanics.auras.length > 0 && (
          <aside
            className="p-3 bg-red-100 dark:bg-red-900/20 rounded-md"
            aria-labelledby="environmental-heading"
          >
            <h4 id="environmental-heading" className="font-bold">
              Environmental Effects:
            </h4>
            <ul className="list-disc list-inside mt-1 space-y-1" role="list">
              {monster.mechanics.auras.map((aura, i) => (
                <li key={i}>
                  <strong>{aura.name}</strong> ({aura.range}): {aura.effect}
                </li>
              ))}
            </ul>
          </aside>
        )}

        {monster.components && monster.components.length > 0 ? (
          <section aria-labelledby="components-heading">
            <h4 id="components-heading" className="font-semibold mb-3">
              Components
            </h4>
            {monster.components.map((component, index) => (
              <article
                key={index}
                className="mb-4 p-3 border border-border rounded-md"
              >
                <header className="mb-2">
                  <h5 className="font-semibold text-base">
                    {component.name}
                    {component.quantity && component.quantity > 1 && (
                      <span
                        className="text-sm font-normal text-muted-foreground ml-2"
                        aria-label={`quantity ${component.quantity}`}
                      >
                        (x{component.quantity})
                      </span>
                    )}
                  </h5>
                </header>
                <div className="space-y-2">
                  <dl>
                    <dt className="inline font-bold">Size:</dt>
                    <dd className="inline">
                      {component.size}
                      {component.movement?.cannotBePushed && (
                        <span className="text-sm text-muted-foreground ml-2">
                          • Cannot be Pushed
                        </span>
                      )}
                    </dd>
                  </dl>
                  <div
                    className="font-mono text-xs bg-muted p-2 rounded"
                    role="img"
                    aria-label={`Stats: Might ${component.abilities.might}, Agility ${component.abilities.agility}, Cunning ${component.abilities.cunning}, Presence ${component.abilities.presence}, Heart Die ${component.heartDie}, ${component.hp} hit points, wound threshold ${
                      component.woundThreshold === null
                        ? "none"
                        : component.woundThreshold
                    }`}
                  >
                    {component.abilities.might}/{component.abilities.agility}/
                    {component.abilities.cunning}/{component.abilities.presence}{" "}
                    <strong>HD</strong> {component.heartDie}{" "}
                    <strong>HP</strong> {component.hp} <strong>w</strong>{" "}
                    {component.woundThreshold === null
                      ? "/"
                      : component.woundThreshold}
                    <br />
                    {formatAttackDefense(component.attack, "A")}{" "}
                    {formatAttackDefense(component.defense, "D")}
                  </div>
                  {component.specialAbilities.length > 0 && (
                    <section aria-labelledby={`abilities-${index}-heading`}>
                      <h6
                        id={`abilities-${index}-heading`}
                        className="font-bold"
                      >
                        Abilities:
                      </h6>
                      <ul
                        className="list-disc list-inside mt-1 space-y-1"
                        role="list"
                      >
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
            <div
              className="font-mono text-xs bg-muted p-2 rounded mb-3"
              role="img"
              aria-label={`Monster stats: Might ${monster.abilities.might}, Agility ${monster.abilities.agility}, Cunning ${monster.abilities.cunning}, Presence ${monster.abilities.presence}, Heart Die ${monster.heartDie}, ${monster.hp} hit points, wound threshold ${
                monster.woundThreshold === null
                  ? "none"
                  : monster.woundThreshold
              }`}
            >
              {monster.abilities.might}/{monster.abilities.agility}/
              {monster.abilities.cunning}/{monster.abilities.presence}{" "}
              <strong>HD</strong> {monster.heartDie} <strong>HP</strong>{" "}
              {monster.hp} <strong>w</strong>{" "}
              {monster.woundThreshold === null ? "/" : monster.woundThreshold}
              <br />
              {formatAttackDefense(monster.attack, "A")}{" "}
              {formatAttackDefense(monster.defense, "D")}
            </div>

            {monster.specialAbilities.length > 0 && (
              <section className="mb-3" aria-labelledby="abilities-heading">
                <h4 id="abilities-heading" className="font-semibold mb-2">
                  Special Abilities
                </h4>
                <ul className="list-disc list-inside space-y-1" role="list">
                  {monster.specialAbilities.map((ability, index) => (
                    <li key={index}>{formatAbility(ability)}</li>
                  ))}
                </ul>
              </section>
            )}

            {monster.movement && (
              <aside className="mb-2" aria-labelledby="movement-heading">
                <h4 id="movement-heading" className="font-bold inline">
                  Movement:
                </h4>
                <span>
                  {monster.movement.cannotBePushed && " Cannot be Pushed"}
                  {monster.movement.speed && ` Speed ${monster.movement.speed}`}
                  {monster.movement.special &&
                    ` (${monster.movement.special.join(", ")})`}
                </span>
              </aside>
            )}

            {monster.mechanics?.phases && monster.mechanics.phases.length > 0 && (
              <aside className="mb-2" aria-labelledby="phases-heading">
                <h4 id="phases-heading" className="font-bold">
                  Phases:
                </h4>
                <ul className="list-disc list-inside mt-1" role="list">
                  {monster.mechanics.phases.map((phase, i) => (
                    <li key={i}>
                      <em>{phase.trigger}:</em> {phase.changes.join("; ")}
                    </li>
                  ))}
                </ul>
              </aside>
            )}
          </section>
        )}
      </div>
    </article>
  );
}