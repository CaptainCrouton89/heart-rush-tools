import { Fragment, type ReactNode } from "react";
import type { AttackDefense, SpecialAbility } from "./schema";

/** Signed bonus as printed in a stat block: +6, −2, +0. */
const signed = (n: number) => (n < 0 ? `−${Math.abs(n)}` : `+${n}`);

/** The parts after the A/D label: "+6", or "+8(s/p) +4(b)". Mirrors formatAttackDefenseMarkdown. */
const attackDefenseParts = (value: number | AttackDefense): string[] => {
  if (typeof value === "number") return [signed(value)];
  const parts: string[] = [];
  if (value.base !== undefined) parts.push(signed(value.base));
  const types = value.byDamageType;
  if (types?.slashingPiercing !== undefined) parts.push(`${signed(types.slashingPiercing)}(s/p)`);
  if (types?.bludgeoning !== undefined) parts.push(`${signed(types.bludgeoning)}(b)`);
  if (types?.other) {
    for (const [type, bonus] of Object.entries(types.other)) parts.push(`${signed(bonus)}(${type})`);
  }
  return parts.length > 0 ? parts : ["+0"];
};

/** "A +6" / "D +8(s/p) +4(b)" with the label bold and the numbers in tabular figures. */
export const formatAttackDefense = (value: number | AttackDefense, prefix: "A" | "D"): ReactNode => (
  <span className="whitespace-nowrap">
    <abbr title={prefix === "A" ? "Attack" : "Defense"} className="font-semibold no-underline">
      {prefix}
    </abbr>{" "}
    <span className="tabular-nums">{attackDefenseParts(value).join(" ")}</span>
  </span>
);

const DICE = /(?<![\w])(\d*d(?:4|6|8|10|12|20|100)(?:\s?[+−-]\s?\d+)?)(?![\w])/g;

/** Text with every dice expression ("1d6", "2d8+3", "d10") set in the `.dice` style. */
export const withDice = (text: string): ReactNode => {
  const pieces = text.split(DICE);
  if (pieces.length === 1) return text;
  return pieces.map((piece, i) =>
    i % 2 === 1 ? (
      <span key={i} className="dice">
        {piece}
      </span>
    ) : (
      <Fragment key={i}>{piece}</Fragment>
    )
  );
};

/** One special ability as a stat-block line: bold name, then the same details formatAbility writes. */
export const AbilityText = ({ ability }: { ability: string | SpecialAbility }) => {
  if (typeof ability === "string") {
    // "Fade: 1/combat, …" — a short leading name before a colon is bolded like a structured ability's name.
    const named = /^([^:]{1,40}):\s(.+)$/s.exec(ability);
    if (!named) return <>{withDice(ability)}</>;
    return (
      <>
        <strong className="font-semibold">{named[1]}</strong>: {withDice(named[2]!)}
      </>
    );
  }
  const desc = ability.description || ability.effect || "";
  return (
    <>
      <strong className="font-semibold">{ability.name}</strong>
      {ability.uses && ` (${ability.uses})`}
      {ability.range && ` [${ability.range}]`}
      {desc && <>: {withDice(desc)}</>}
      {ability.save && (
        <span className="whitespace-nowrap">{` (${ability.save.type}${ability.save.dc})`}</span>
      )}
      {ability.damage && (
        <>
          {" ["}
          {withDice(ability.damage)}
          {" damage]"}
        </>
      )}
    </>
  );
};

export const formatAttackDefenseMarkdown = (
  value: number | AttackDefense,
  prefix: string
): string => {
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
      result = result
        ? `${result} ${parts.join(" ")}`
        : `**${prefix}** ${parts.join(" ")}`;
    }
  }

  return result || `**${prefix}** +0`;
};

export const formatAbility = (ability: string | SpecialAbility): string => {
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
