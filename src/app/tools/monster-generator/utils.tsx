import React from "react";
import { AttackDefense, SpecialAbility } from "./types";

export const formatAttackDefense = (
  value: number | AttackDefense,
  prefix: string
): React.JSX.Element => {
  if (typeof value === "number") {
    return (
      <span key={`${prefix}-${value}`}>
        <strong>{prefix}</strong> +{value}
      </span>
    );
  }

  const parts: React.JSX.Element[] = [];

  if (value.base !== undefined) {
    parts.push(
      <span key={`${prefix}-${value.base}`}>
        <strong>{prefix}</strong> +{value.base}
      </span>
    );
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
        parts.push(
          <>
            <strong>{prefix}</strong> {typeParts.join(" ")}
          </>
        );
      } else {
        parts.push(<> {typeParts.join(" ")}</>);
      }
    }
  }

  return parts.length > 0 ? (
    <>{parts}</>
  ) : (
    <>
      <strong>{prefix}</strong> +0
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

export const copyToClipboard = async (
  text: string,
  setCopied: (value: boolean) => void
) => {
  try {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  } catch (err) {
    console.error("Failed to copy to clipboard:", err);
  }
};
