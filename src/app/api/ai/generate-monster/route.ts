import { openai } from "@ai-sdk/openai";
import { generateObject, generateText } from "ai";
import { z } from "zod";

const dieSchema = z.enum(["d4", "d6", "d8", "d10", "d12", "d20"]);

const conditionalBonusSchema = z.object({
  condition: z.string(),
  bonus: z.number().int(),
});

const saveSchema = z.object({
  type: z.enum(["MC", "AC", "CC", "PC"]),
  dc: z.number().int().min(1),
});

const specialAbilitySchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  type: z
    .enum(["passive", "triggered", "action", "reaction", "aura"])
    .optional(),
  trigger: z.string().optional(),
  uses: z.string().optional(),
  range: z.string().optional(),
  save: saveSchema.optional(),
  effect: z.string().optional(),
  damage: z.string().optional(),
  conditions: z
    .array(
      z.object({
        name: z.string(),
        levels: z.number().int().min(1).optional(),
        duration: z.string().optional(),
      })
    )
    .optional(),
});

const attackDefenseSchema = z.union([
  z.number().int(),
  z.object({
    base: z.number().int().optional(),
    byDamageType: z
      .object({
        slashingPiercing: z.number().int().optional(),
        bludgeoning: z.number().int().optional(),
        other: z.record(z.number().int()).optional(),
      })
      .optional(),
    conditional: z.array(conditionalBonusSchema).optional(),
  }),
]);

const baseMonsterSchema = z.object({
  name: z.string().describe("The monster's name"),
  subtitle: z.string().optional().describe("Optional subtitle or description"),
  size: z
    .string()
    .regex(/^(S|M|L[0-9]*)$/)
    .describe("Size category: S, M, L, L2, L3, etc."),
  abilities: z
    .object({
      might: dieSchema,
      agility: dieSchema,
      cunning: dieSchema,
      presence: dieSchema,
    })
    .describe("The four ability dice"),
  heartDie: dieSchema.describe(
    "The creature's heart die (stamina/fighting spirit)"
  ),
  hp: z.number().int().min(1).describe("Hit points"),
  woundThreshold: z
    .number()
    .int()
    .min(1)
    .nullable()
    .describe("Minimum damage to inflict a wound (null for unwoundable)"),
  attack: attackDefenseSchema.describe("Attack bonus"),
  defense: attackDefenseSchema.describe("Defense bonus"),
  specialAbilities: z
    .array(z.union([z.string(), specialAbilitySchema]))
    .describe("Special abilities"),
  movement: z
    .object({
      cannotBePushed: z.boolean().optional(),
      speed: z.number().int().optional(),
      special: z.array(z.string()).optional(),
    })
    .optional()
    .describe("Movement capabilities"),
  mechanics: z
    .object({
      engagementsPerRound: z.number().int().min(1).optional(),
      phases: z
        .array(
          z.object({
            trigger: z.string(),
            changes: z.array(z.string()),
          })
        )
        .optional(),
      auras: z
        .array(
          z.object({
            name: z.string(),
            range: z.string(),
            effect: z.string(),
            save: saveSchema.optional(),
          })
        )
        .optional(),
    })
    .optional()
    .describe("Special combat mechanics"),
  notes: z.string().optional().describe("Additional GM notes or tactics"),
});

const componentSchema = baseMonsterSchema.extend({
  quantity: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("How many of this component exist"),
  shared: z
    .boolean()
    .optional()
    .describe("Whether damage is shared across all instances"),
});

const monsterSchema = baseMonsterSchema.extend({
  components: z
    .array(componentSchema)
    .optional()
    .describe("For multi-part monsters like The Skittering Horror"),
});

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { concept } = await request.json();

    if (!concept || typeof concept !== "string") {
      return Response.json(
        { error: "Monster concept is required" },
        { status: 400 }
      );
    }

    // Step 1: Use 4.1-mini to flesh out the concept simply
    const { text: enhancedConcept } = await generateText({
      model: openai("gpt-4.1-mini"),
      system: `You create simple, concise monster descriptions. Keep responses very brief and match the complexity of the input.

CRITICAL: For simple 1-2 word inputs, explicitly state they are "simple" and avoid elaboration.

Examples:
- Input: "goblin monk" → "A simple goblin monk, with a single, unflashy ability"
- Input: "rat" → "A simple rat, basic creature, no abilities"
- Input: "orc" → "A simple orc warrior, straightforward fighter, 0-1 abilities"
- Input: "skeleton" → "A simple animated skeleton, basic undead, 0-1 abilities"
- Input: "wolf" → "A simple wolf, pack hunter, 1-2 abilities"
- Input: "goblin monk boss" → "A goblin monk, master of advanced martial arts. Boss power level, a few abilities"
- Input: "ancient dragon" → "An ancient dragon, legendary creature with devastating breath and magic, 4-5 abilities"
- Input: "fire elemental lord" → "A fire elemental lord, elite creature commanding flames and heat, 3-4 abilities"

For simple inputs (1-2 words): Always use "simple" and keep under 10 words.
For complex inputs: Elaborate appropriately but stay under 20 words.`,
      prompt: `Create a simple description for: ${concept}`,
    });

    console.log(enhancedConcept);
    // throw new Error("test");

    // Step 2: Use the enhanced concept to generate the full monster with 4.1
    const { object } = await generateObject({
      model: openai("gpt-4.1"),
      schema: monsterSchema,
      system: `You are an expert at creating monsters for the Heart Rush TTRPG system. Generate balanced, interesting monster statblocks that follow the game's design principles, and match the complexity of the input.

# Heart Rush Monster Creation Guidelines

## Core Statblock Format

### Basic Template
**Name**: [Monster Name]
*[Optional Subtitle]*
**Size**: [S/M/L/L2/L3/etc.]
[Might]/[Agility]/[Cunning]/[Presence] **HD** [d4-d20] **HP** [Number] **w** [Threshold or /]
**A** +[Bonus] **D** +[Bonus]
- [Special Ability 1]
- [Special Ability 2]

### Size Categories
- **S** - Small (halflings, goblins, small animals)
- **M** - Medium (humans, most humanoids)
- **L** - Large (ogres, horses)
- **L2** - Huge (giants, young dragons)
- **L3+** - Gargantuan (ancient dragons, titans)
- Sizes can go up to L8 or higher for truly massive creatures

### Ability Scores (Might/Agility/Cunning/Presence)
- Each ability uses a die from d4 to d20
- **d4** - Terrible (weakest possible)
- **d6** - Poor
- **d8** - Average
- **d10** - Good
- **d12** - Excellent
- **d20** - Legendary (strongest possible)

### Heart Die (HD)
Represents the creature's stamina and fighting spirit. Ranges from d4 to d20.
- **d4-d6** - Fragile creatures
- **d8-d10** - Standard combatants
- **d12-d20** - Elite or boss monsters

### Hit Points (HP)
The creature's total health pool. Generally scales with size and threat level.

### Wound Threshold (w)
The minimum damage needed to inflict a wound. Use "/" if the creature cannot be wounded.
- Small creatures: 5-10
- Medium creatures: 10-15
- Large creatures: 15-20
- Boss monsters: 20+

### Attack and Defense Bonuses
- **A** (Attack): Flat bonus added to attack rolls
- **D** (Defense): Flat bonus added to defense rolls
- Can specify different bonuses vs damage types: **D** +8(s/p) +4(b) means +8 vs slashing/piercing, +4 vs bludgeoning

## Special Abilities Guidelines

### Common Ability Types
- **Conditional Advantages**: "Adv A when [condition]" or "Adv D when [condition]"
- **A2/D2**: Double advantage on attacks/defense
- **Status Effects**: Apply conditions like poisoned, dazed, off-balanced, weakened, stunned, blinded, frightened
- **Triggered Abilities**: "On stance beat, [effect]" or "When [trigger], [effect]"
- **Saving Throws**: MC/AC/CC/PC with DCs typically 8-12, with 15+ for devastating effects
- **Usage Limitations**: "1/engagement", "1/round", "recharge 5-6"

### Environmental Effects
- **Difficult Terrain**: "All ground within [distance] is difficult terrain"
- **Magical Difficult Terrain**: Enhanced version that's harder to navigate
- **Area Damage**: "All creatures within [distance] take [damage] per round"
- **Conditions**: Apply ongoing effects like slowed, blinded, prone

## Monster Examples by Complexity

### Simple Monsters
**Giant Rats**
**Size**: M
4/6/4/4 **HD** 6 **HP** 20 **w** 5
**A** +4 **D** +2
- Adv A when near an ally

**Wind-Touched Wraiths**
**Size**: M
4/4/4/4 **HD** 6 **HP** 20 **w** 10
**A** +2 **D** +0
- On stance beat, PC9 or gain one level of Yearning

### Elite Monsters
**Queen Rat**
**Size**: L
6/8/6/6 **HD** 8 **HP** 50 **w** 12
**A** +6 **D** +5
- Adv A/D when near an ally
- Poisonedx1 when wounding
- Trade places with an ally to avoid damage
- 1/engagement, plague (1d4 dmg w/in 10ft, MC 9, poisoned x1)

**Sand Serpents**
**Size**: L2
4/8/8/4 **HD** 6 **HP** 40 **w** 10
**A** +4 **D** +2
- A2 on restrained or prone targets
- Quicksand - AC 9 or restrained. Action to get out

### Boss Monsters
**The Starving**
**Size**: M
10/10/10/12 **HD** 10 **HP** 100 **w** 10
**A** +8 **D** +8
- Engage 2x a round
- ALL STANCE BEAT ATTACKS DEAL MAX HP DAMAGE
- On stance beat MC8: Success increases The Hunger Sickness by 1, Failure: Infected with The Gorge

## Multi-Part Monsters

Multi-part monsters consist of multiple components that work together. Each component has its own stats but contributes to the overall encounter.

### Design Principles for Multi-Part Monsters
1. **Different Roles**: Each component should serve a distinct tactical purpose
2. **Interdependence**: Components should interact meaningfully
3. **Progression**: Destroying components should change the encounter dynamics
4. **Clear Targets**: Players should understand what they can attack

### Multi-Part Example: The Skittering Horror
*Heart of Inertia*
A towering, spider-like creature with countless skeletal legs. Players must destroy its legs to bring down the carapace.

**Components:**
1. **Legs** (x12) - Mobile attackers that create difficult terrain
2. **Carapace** - Main body that becomes vulnerable when enough legs are destroyed  
3. **Heart of Inertia** - Core that's only exposed when carapace is destroyed

**Legs**
**Size**: L. Cannot be Pushed.
10/10/6/6 **HD** 6 **HP** 30 **w** /
**A** +4 **D** +8(s/p) +4(b)
- Tremors - all ground w/in 10 ft is difficult terrain
- When moving through space or making a/d roll, AC10 fall prone
- Shudder - When 6-7 legs destroyed, carapace wobbles violently

**Carapace**
**Size**: L8. Cannot be Pushed.
10/10/10/6 **HD** 10 **HP** 60 **w** 15
**A** 0; Cannot make attacks, always chooses Defense
**D** +6; +2 for each remaining group of legs
- Unless downed (8 legs destroyed) the Carapace is 60ft off the ground
- Sandstorm - creatures w/in 15 ft take 1d6 piercing/round, slowed, blind 1
- Sinkhole - creatures w/in 30ft MC10 or pulled 10ft toward center
- Grit - If player doesn't move 10+ feet or ends prone, gain lethargy level

**Heart of Inertia**
**HP** 20 **w** /
**A** 0; Cannot make attacks, always chooses Defense
**D** +2
- Only exposed when Carapace at 0HP
- Heals 1d8 to Carapace each round
- All creatures w/in 30ft PC12 or stunned 1/round
- Vitality Drain - creatures starting turn w/in 10ft take 1d8 MAX HP damage

## Scaling Guidelines
- **Minions**: 10-20 HP, w5-8, simple abilities
- **Standard**: 25-40 HP, w8-12, 1-2 abilities  
- **Elite**: 40-60 HP, w12-15, 2-3 abilities
- **Boss**: 60+ HP, w15+, 3+ abilities, unique mechanics
- **Multi-Part**: Each component follows above guidelines based on its role

## Design Principles
1. Match abilities to the creature's concept and role
2. Balance action economy for bosses with multiple engagements or area effects
3. Use thematic abilities that enhance narrative
4. Consider environmental effects and tactical positioning
5. Ensure abilities have clear triggers and effects
6. For multi-part monsters, create meaningful interactions between components

Create monsters that are tactically interesting and thematically coherent.`,
      prompt: `Generate a complete Heart Rush monster statblock based on this enhanced concept:

${enhancedConcept}

Create a monster that matches the complexity of the concept. Include appropriate special abilities that reflect the thematic elements and tactical role described, if any.`,
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
