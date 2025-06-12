import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

const monsterSchema = z.object({
  name: z.string().describe("The name of the monster"),
  subtitle: z.string().optional().describe("Optional subtitle or title"),
  size: z
    .enum(["S", "M", "L", "L2", "L3", "L4", "L5"])
    .describe("Size: S (Small), M (Medium), L (Large), L2 (2x Large), etc."),
  abilities: z
    .object({
      might: z.enum(["4", "6", "8", "10", "12", "20"]).describe("Might die size"),
      agility: z.enum(["4", "6", "8", "10", "12", "20"]).describe("Agility die size"),
      cunning: z.enum(["4", "6", "8", "10", "12", "20"]).describe("Cunning die size"),
      presence: z.enum(["4", "6", "8", "10", "12", "20"]).describe("Presence die size"),
    })
    .describe("Heart Rush ability scores as die sizes"),
  heartDie: z
    .enum(["d4", "d6", "d8", "d10", "d12", "d20"])
    .describe("Heart Die representing stamina/fighting spirit"),
  defenseBonus: z.number().min(0).describe("Defense bonus (+X)"),
  attackBonus: z.number().min(0).describe("Attack bonus (+X)"),
  hitPoints: z.number().min(1).describe("Total hit points"),
  woundThreshold: z.number().min(1).describe("Damage needed to inflict a wound"),
  specialAbilities: z
    .array(z.string())
    .describe("List of special abilities, each as a concise string"),
  advantages: z
    .array(z.string())
    .optional()
    .describe("Special advantages like 'Adv A', 'Adv D', 'A2', etc."),
  disadvantages: z
    .array(z.string())
    .optional()
    .describe("Special disadvantages like 'D1', 'D3', 'D5', etc."),
  isComplex: z.boolean().describe("Whether this is a complex/boss monster"),
  solution: z.string().optional().describe("Strategic hint for players (complex monsters)"),
  complications: z.string().optional().describe("Environmental effects (complex monsters)"),
  mechanic: z.string().optional().describe("Unique combat mechanics (complex monsters)"),
  components: z
    .array(
      z.object({
        name: z.string().describe("Component name"),
        size: z.enum(["S", "M", "L", "L2", "L3", "L4", "L5"]),
        abilities: z.object({
          might: z.enum(["4", "6", "8", "10", "12", "20"]),
          agility: z.enum(["4", "6", "8", "10", "12", "20"]),
          cunning: z.enum(["4", "6", "8", "10", "12", "20"]),
          presence: z.enum(["4", "6", "8", "10", "12", "20"]),
        }),
        heartDie: z.enum(["d4", "d6", "d8", "d10", "d12", "d20"]),
        defenseBonus: z.number().min(0),
        attackBonus: z.number().min(0),
        hitPoints: z.number().min(1),
        woundThreshold: z.number().min(1),
        specialAbilities: z.array(z.string()),
      })
    )
    .optional()
    .describe("Multiple components for complex monsters"),
});

export async function POST(request: Request) {
  try {
    const { concept } = await request.json();

    if (!concept || typeof concept !== "string") {
      return Response.json(
        { error: "Monster concept is required" },
        { status: 400 }
      );
    }

    const { object } = await generateObject({
      model: openai("gpt-4.1"),
      schema: monsterSchema,
      prompt: `Create a detailed Heart Rush monster stat block based on this concept: "${concept}"

Heart Rush uses a unique tactical stat system. Follow this comprehensive template and guidelines:

## Basic Format Template

#### [Monster Name]
*[Subtitle/Title if applicable]*
**Size**: [S/M/L/L2/L3/etc]
[Might]/[Agility]/[Cunning]/[Presence] **HD** [d4-d20] **D** +[#] **A** +[#] **HP** [#] w [#]
- [Ability 1]
- [Ability 2]
- [etc.]

## Field Explanations

**Size Categories:**
- S (Small), M (Medium), L (Large), L2 (2x Large), L3 (3x Large), etc.
- Larger numbers indicate increasingly massive creatures

**Ability Scores** (in order: Might/Agility/Cunning/Presence):
- Listed as die sizes: 4, 6, 8, 10, 12, 20
- HD (Heart Die): d4 through d20 - represents stamina/fighting spirit
- D (Defense Bonus): +X added to defense rolls
- A (Attack Bonus): +X added to attack rolls
- HP (Hit Points): Total health
- w (Wound Threshold): Damage needed to inflict a wound

## Special Notations

**Advantages/Disadvantages:**
- Adv A = Advantage on Attack
- Adv D = Advantage on Defense
- A2 = Double advantage on attack
- D1/D3/D5 = 1/3/5 levels of disadvantage

**Ability Checks (like saving throws):**
- MC = Might Check (MC9 means might check vs difficulty 9)
- AC = Agility Check
- CC = Cunning Check
- PC = Presence Check

**Damage Types (when relevant):**
- s = slashing, p = piercing, b = bludgeoning

## Complex Monster Template

For boss monsters with multiple parts:

### [Boss Name]
*[Epic Title]*
**[Type]**, [Description]
**Solution**: [Strategic hint for players]
**Complications**: [Environmental effects or special rules]
**Mechanic**: [Unique combat mechanics]

#### Stats
##### Components
###### [Component Name]
[Use basic format for each component]

## Ability Writing Patterns

1. **Conditional Bonuses**: "Adv A when flanking", "A2 vs prone targets"
2. **On-Hit Effects**: "Poisonedx1 when wounding", "Blind 1 on crit"
3. **Defensive Abilities**: "Trade places with ally to avoid damage"
4. **Limited Use**: "1/engagement, [ability] ([effect], MC 12)"
5. **Auras/Areas**: "Difficult terrain w/in 15ft", "1d4 dmg w/in 10ft"
6. **Movement Restrictions**: "Cannot be Pushed", "Grit: gain lethargy if don't move 10ft"
7. **Ability Check Triggers**: "CC 15 or Slowed", "AC 9 or restrained"

## Complexity Examples

**Simple** (Giant Rats): Basic stats, 1-2 simple abilities
**Moderate** (Queen Rat): Enhanced stats, 3-4 abilities with triggers
**Complex** (Sand Serpents): Solution notes, environmental abilities  
**Boss** (Skittering Horror): Multiple components, environmental hazards, phase mechanics

## Scaling Guidelines

**Minions**: 4-6 abilities, HD d4-d6, HP 10-30, bonuses +0 to +4
**Elites**: 6-10 abilities, HD d6-d10, HP 30-60, bonuses +4 to +8
**Bosses**: 8-20 abilities, HD d8-d20, HP 40-100+, bonuses +6 to +15

**Wound Thresholds**: Small w 3-8, Medium w 5-12, Large w 10-20, Boss w 15+ or w /

Create a tactically engaging monster with clear counterplay that matches "${concept}".`,
    });

    return Response.json({ object });
  } catch (error) {
    console.error("Error generating monster:", error);

    if (error instanceof Error) {
      return Response.json(
        { error: `Failed to generate monster: ${error.message}` },
        { status: 500 }
      );
    }

    return Response.json(
      { error: "Failed to generate monster" },
      { status: 500 }
    );
  }
}
