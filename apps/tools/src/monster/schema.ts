import { z } from "zod";

// Ported unchanged from the old Next.js route (src/app/api/ai/generate-monster/route.ts),
// except z.record needs an explicit key schema in zod 4.
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
        other: z.record(z.string(), z.number().int()).optional(),
      })
      .optional(),
    conditional: z.array(conditionalBonusSchema).optional(),
  }),
]);

const baseMonsterSchema = z.object({
  name: z.string().describe("The monster's name"),
  subtitle: z.string().optional().describe("Optional subtitle, such as an epithet or title"),
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
  hp: z.number().int().min(10).describe("Hit points - 40 is 'average'"),
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
      speed: z.number().int().optional().describe("Movement speed, default 60"),
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

const { name, subtitle, ...stats } = baseMonsterSchema.shape;

/** What the model writes. `description` comes right after the name so it is written before the numbers. */
export const monsterSchema = z.object({
  name,
  subtitle,
  // Optional so encounters saved before descriptions existed still parse; the prompts ask for it every time.
  description: z
    .string()
    .optional()
    .describe(
      "2-4 sentences for the GM to read aloud or paraphrase: what the creature looks like, how it behaves, and how it fights"
    ),
  ...stats,
  image: z.string().optional().describe("Stored illustration URL added by the app; preserve existing URLs but never invent one"),
  components: z
    .array(componentSchema)
    .optional()
    .describe("For multi-part monsters like The Skittering Horror"),
});

/** What a model run writes: a required description and no app-assigned image URL. Stored monsters keep both fields optional. */
export const generatedMonsterSchema = monsterSchema.omit({ image: true }).required({ description: true });

export const analysisSchema = z.object({
  analysis: z
    .string()
    .describe(
      "The analysis text in exactly the requested format: LEVEL, ABILITIES, HEALTH and DESCRIPTION lines."
    ),
});

export type MonsterStatBlock = z.infer<typeof monsterSchema>;
export type Component = NonNullable<MonsterStatBlock["components"]>[number];
export type AttackDefense = MonsterStatBlock["attack"];
export type SpecialAbility = MonsterStatBlock["specialAbilities"][number];
