import { MonsterStatBlock } from "./types";
import { formatAbility, formatAttackDefenseMarkdown } from "./utils";

export const generateMarkdown = (monster: MonsterStatBlock): string => {
  let markdown: string;

  if (monster.components && monster.components.length > 0) {
    // Multi-part monster
    markdown = `### ${monster.name}\n`;
    if (monster.subtitle) markdown += `*${monster.subtitle}*\n\n`;

    if (monster.notes) markdown += `${monster.notes}\n\n`;

    if (monster.mechanics?.auras && monster.mechanics.auras.length > 0) {
      markdown += `**Environmental Effects:**\n`;
      monster.mechanics.auras.forEach((aura) => {
        markdown += `- **${aura.name}** (${aura.range}): ${aura.effect}\n`;
      });
      markdown += `\n`;
    }

    markdown += `#### Components\n`;

    monster.components.forEach((component) => {
      markdown += `##### ${component.name}`;
      if (component.quantity && component.quantity > 1) {
        markdown += ` (x${component.quantity})`;
      }
      markdown += `\n`;

      markdown += `**Size**: ${component.size}`;
      if (component.movement?.cannotBePushed) {
        markdown += ". Cannot be Pushed";
      }
      if (component.shared) {
        markdown += ". Shared damage";
      }
      markdown += `.\n`;

      if (component.movement) {
        const movementParts: string[] = [];
        if (component.movement.speed) {
          movementParts.push(`Speed ${component.movement.speed}`);
        }
        if (
          component.movement.special &&
          component.movement.special.length > 0
        ) {
          movementParts.push(`(${component.movement.special.join(", ")})`);
        }
        if (movementParts.length > 0) {
          markdown += `**Movement**: ${movementParts.join(" ")}\n`;
        }
      }

      const attackStr = formatAttackDefenseMarkdown(component.attack, "A");
      const defenseStr = formatAttackDefenseMarkdown(component.defense, "D");
      const woundStr =
        component.woundThreshold === null ? "/" : component.woundThreshold;

      markdown += `${component.abilities.might}/${component.abilities.agility}/${component.abilities.cunning}/${component.abilities.presence} **HD** ${component.heartDie} **HP** ${component.hp} **w** ${woundStr}\n`;
      markdown += `${attackStr} ${defenseStr}\n`;

      component.specialAbilities.forEach((ability) => {
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

    if (monster.movement) {
      const movementParts: string[] = [];
      if (monster.movement.speed) {
        movementParts.push(`Speed ${monster.movement.speed}`);
      }
      if (monster.movement.special && monster.movement.special.length > 0) {
        movementParts.push(`(${monster.movement.special.join(", ")})`);
      }
      if (movementParts.length > 0) {
        markdown += `**Movement**: ${movementParts.join(" ")}\n`;
      }
    }

    const attackStr = formatAttackDefenseMarkdown(monster.attack, "A");
    const defenseStr = formatAttackDefenseMarkdown(monster.defense, "D");
    const woundStr =
      monster.woundThreshold === null ? "/" : monster.woundThreshold;

    markdown += `${monster.abilities.might}/${monster.abilities.agility}/${monster.abilities.cunning}/${monster.abilities.presence} **HD** ${monster.heartDie} **HP** ${monster.hp} **w** ${woundStr}\n`;
    markdown += `${attackStr} ${defenseStr}\n`;

    if (
      monster.mechanics?.engagementsPerRound &&
      monster.mechanics.engagementsPerRound > 1
    ) {
      markdown += `Engage ${monster.mechanics.engagementsPerRound}x a round\n`;
    }

    monster.specialAbilities.forEach((ability) => {
      markdown += `- ${formatAbility(ability)}\n`;
    });

    if (monster.mechanics?.phases && monster.mechanics.phases.length > 0) {
      markdown += `\n**Phases**:\n`;
      monster.mechanics.phases.forEach((phase) => {
        markdown += `- *${phase.trigger}*: ${phase.changes.join("; ")}\n`;
      });
    }

    if (monster.notes) {
      markdown += `\n**Notes**: ${monster.notes}\n`;
    }
  }

  return markdown;
};
