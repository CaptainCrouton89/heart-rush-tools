# Creating Monsters for Heart Rush

When you're crafting opponents for Heart Rush, you're not just filling stat blocks—you're designing tactical puzzles that challenge players to think beyond "I attack." Every monster should force interesting decisions during both the action phase and engagement, creating memorable encounters that feel dangerous and dynamic. This guide will teach you how to build creatures that leverage Heart Rush's unique combat system.

## Understanding the Monster Statblock

Heart Rush monsters use a streamlined format that captures everything you need at a glance. Here's what each element means and why it matters for your encounters:

[[### [Monster Name]

_[Optional Subtitle/Description]_
**Size**: [S/M/L/L2/L3/etc.]
[Might]/[Agility]/[Cunning]/[Presence] **HD** [d4-d20] **HP** [Number] **w** [Threshold]
**A** +[Bonus] **D** +[Bonus]

- [Special Ability 1]
- [Special Ability 2]]]

Let's break down each component:

### Size Categories

Size affects more than just space on the battlefield—it determines grappling advantages, climbing opportunities, and psychological impact:

| Size       | Code | Examples                       | Combat Implications                      |
| ---------- | ---- | ------------------------------ | ---------------------------------------- |
| Small      | S    | Goblins, halflings, wolves     | Harder to grapple, easier to knock prone |
| Medium     | M    | Humans, orcs, most humanoids   | Standard baseline for all mechanics      |
| Large      | L    | Ogres, horses, young griffons  | +1 advantage when grappling smaller foes |
| Huge       | L2   | Giants, young dragons          | Can be climbed on by Medium creatures    |
| Gargantuan | L3   | Elder dragons, krakens         | Multiple engagement zones possible       |
| Colossal   | L4+  | Ancient titans, world serpents | Environmental hazard as much as enemy    |

**Design Tip**: Larger creatures should feel overwhelming in direct confrontation but offer opportunities for clever tactics like climbing on them or exploiting blind spots.

### Ability Scores

The four abilities define how monsters interact with Heart Rush's stance system. Unlike weapons that add dice, monsters use flat bonuses for simplicity—but their ability dice still matter for contests and saves:

| Die Size | Descriptor | When to Use                     |
| -------- | ---------- | ------------------------------- |
| d4       | Terrible   | Fundamental weakness to exploit |
| d6       | Poor       | Below average, vulnerability    |
| d8       | Average    | Competent but unremarkable      |
| d10      | Good       | Notable strength                |
| d12      | Excellent  | Defining characteristic         |
| d20      | Legendary  | Mythic-level prowess            |

**Might/Agility/Cunning/Presence** - Write these in order, representing:

- **Might**: Physical power, endurance, breaking things
- **Agility**: Speed, reflexes, dodging
- **Cunning**: Tactics, perception, exploiting weaknesses
- **Presence**: Force of personality, intimidation, magic

### Heart Die & Hit Points

The **Heart Die (HD)** represents stamina and fighting spirit—how well the creature can push through adversity. When spending stamina to halve damage, they reduce this die size:

| Heart Die | Creature Type    | Stamina Management          |
| --------- | ---------------- | --------------------------- |
| d4        | Fragile minions  | Can only halve damage once  |
| d6        | Standard fodder  | Limited defensive options   |
| d8        | Solid combatants | Moderate staying power      |
| d10       | Elite warriors   | Good tactical flexibility   |
| d12       | Champions        | Excellent damage mitigation |
| d20       | Legendary foes   | Nearly unstoppable momentum |

**Hit Points** determine actual durability. Unlike players, monsters typically can't heal mid-combat, so their HP represents their total combat effectiveness.

### Wound Threshold

The **wound threshold (w)** indicates how much damage in a single hit creates a lasting injury. This number creates different combat dynamics:

| Threshold | Meaning     | Tactical Impact                      |
| --------- | ----------- | ------------------------------------ |
| 5-8       | Fragile     | Players can wound with basic attacks |
| 10-12     | Standard    | Requires solid hits or combos        |
| 15-18     | Tough       | Demands powerful abilities or crits  |
| 20+       | Armored     | Only devastating blows leave marks   |
| /         | Unwoundable | No lasting injuries possible         |

**Design Tip**: Use "/" for creatures that shouldn't suffer wounds—swarms, elementals, or disposable minions. This keeps bookkeeping simple while maintaining threat.

### Attack & Defense Bonuses

These flat modifiers replace weapon and armor dice for monsters, streamlining combat while maintaining effectiveness:

- **A +X**: Added to all attack rolls
- **D +X**: Added to all defense rolls

You can specify different defenses against damage types:

- **D** +8(s/p) +4(b) means better against slashing/piercing than bludgeoning
- **D** +10 +5(ranged) means stronger in melee than against arrows

## Designing Compelling Abilities

Monster abilities should create interesting decisions, not just add numbers. Focus on abilities that:

1. **Change engagement dynamics** - Force players to reconsider stance choices
2. **Reward or punish positioning** - Make the action phase matter
3. **Create cascading effects** - One monster's ability sets up another's
4. **Tell a story** - Reinforce what this creature _is_

### Core Ability Templates

[[Stance Rewards

- On stance beat, [effect]
- When winning with might, [effect]
- If defending in cunning stance, [effect]
  ]]

These abilities make stance selection more complex than simple rock-paper-scissors. Players must weigh the risk of triggering these effects against their tactical needs.

[[Conditional Advantages

- Adv A when [condition]
- A2 against [target type]
- Adv D while [circumstance]
  ]]

Advantages multiply the impact of good positioning or proper setup. Design conditions that players can manipulate through smart play.

[[Status Applications

- On hit, AC10 or dazed×2
- Start of round, all within 10ft MC12 or sickened×1
- When bloodied, aura of frightened×1 (PC10 negates)
  ]]

Status effects create lasting consequences beyond damage. Use save DCs that give players meaningful choice—burn stamina for better saves, or accept the condition?

[[Triggered Responses

- When damaged by fire, explode for 1d6 in 10ft
- If reduced below half HP, gain extra engagement
- When an ally dies, enter rage (all attacks gain advantage)
  ]]

These abilities create dynamic battlefields where the situation evolves based on player actions.

### Advanced Ability Concepts

#### Multi-Phase Encounters

Design creatures that transform as they take damage:

[[### Metamorphic Horror

- **Phase 1** (60+ HP): Defensive, probing attacks
- **Phase 2** (30-59 HP): Aggressive, reveals true form
- When reduced below 30 HP, split into two Horrorlings]]

#### Environmental Integration

Creatures that reshape the battlefield:

[[### Earthshaker Elemental

- All ground within 20ft becomes difficult terrain
- 1/round, create 10ft stone wall (HP 20)
- When moving, MC10 or knocked prone for adjacent creatures]]

#### Component Creatures

Multi-part monsters requiring different tactics:

[[### Hydra

**Body**: L2, attacks anyone adjacent
**Heads** (×3): M, 30ft reach, independent targets

- Destroying a head spawns two new heads next round
- Body takes half damage while any head survives]]

## Scaling Encounters

Different threat levels serve different purposes in your campaigns:

### Minions (Fodder)

**Purpose**: Drain resources, create positioning puzzles

- **HP**: 10-20
- **Wound**: 5-8 or /
- **Abilities**: 1 simple effect
- **Example**: Goblin scouts that gain advantage when flanking

### Standard Threats

**Purpose**: Core combat challenges

- **HP**: 25-40
- **Wound**: 8-12
- **Abilities**: 1-2 that synergize
- **Example**: Orc warriors with "On stance beat, weakened×2"

### Elite Enemies

**Purpose**: Mini-boss encounters, lieutenants

- **HP**: 40-60
- **Wound**: 12-15
- **Abilities**: 2-3 including defensive options
- **Example**: Vampire spawn with regeneration and life drain

### Boss Monsters

**Purpose**: Climactic encounters, memorable fights

- **HP**: 60-100+
- **Wound**: 15+
- **Abilities**: 3+ including unique mechanics
- **Example**: Dragon with breath weapon, frightening presence, and reactive movements

### Legendary Foes

**Purpose**: Campaign-defining encounters

- **HP**: 100+
- **Wound**: 20+
- **Abilities**: Complete tactical puzzle
- **Multiple engagements**: Act more than once per round
- **Lair actions**: Environmental effects between rounds

## Combat Balance Guidelines

Creating balanced encounters requires understanding Heart Rush's action economy and damage expectations:

### Action Economy Rules

**Single powerful enemies need:**

- Multiple engagements per round, OR
- Abilities affecting multiple PCs, OR
- Environmental hazards that act independently

**Groups should include:**

- Different stance preferences (some favor might, others agility)
- Complementary abilities (one applies conditions, another exploits them)
- Varied ranges and movement options

### Damage Expectations

Calculate average damage based on party optimization:

- **Basic attack**: ~5-8 damage
- **Optimized attack**: ~10-15 damage
- **Nova round**: ~20+ damage

Monsters should threaten meaningful damage:

- **Minions**: 3-5 damage (chip away at resources)
- **Standard**: 5-10 damage (real threat)
- **Elite**: 10-15 damage (force stamina use)
- **Boss**: 15-20+ damage (create wound risk)

### Save DC Guidelines

Set DCs based on consequence severity:

| DC  | Difficulty | Use When                    |
| --- | ---------- | --------------------------- |
| 8   | Easy       | Minor annoyance effects     |
| 10  | Moderate   | Standard combat conditions  |
| 12  | Hard       | Significant tactical shifts |
| 15  | Very Hard  | Devastating effects         |
| 18+ | Extreme    | Save-or-die situations      |

## Example Monster Creation Process

Let's build a monster from concept to completion:

**Concept**: A ghostly knight that punishes aggressive fighters

**Step 1 - Core Stats**:
Medium undead, tough but not agile

- Size: M
- Abilities: 10/6/10/8 (strong, slow, tactical, intimidating)
- HD: d10 (good stamina)
- HP: 50 (elite threat level)
- Wound: 15 (armor makes wounding difficult)

**Step 2 - Combat Stats**:

- A: +6 (skilled warrior)
- D: +8 vs physical, +4 vs magic (ghostly nature)

**Step 3 - Abilities**:
Design abilities reinforcing the concept:

[[### Phantom Knight

_Cursed Guardian of the Fallen Temple_
**Size**: M
10/6/10/8 **HD** 10 **HP** 50 **w** 15
**A** +6 **D** +8(physical) +4(magic)

- **Ghostly**: Can move through creatures/objects, difficult terrain doesn't slow
- **Punish Aggression**: When attacked in might stance, attacker takes 1d6 psychic damage
- **Spectral Chains**: On stance beat, MC12 or pulled 10ft and grappled
- **Fade**: 1/combat, become incorporeal until next turn (can't attack or be attacked)]]

This creates a monster that:

- Punishes might-stance attackers
- Rewards cunning/agility approaches
- Uses positioning (chains) to control battle
- Has an escape option preventing easy focus-fire

## Quick Monster Templates

For rapid encounter building, modify these templates:

### Brute

[[[Name] L [8-10]/[4-6]/[4-6]/[4-6] HD8 HP40 w12
A+8 D+4 | On might stance beat, knock prone | Takes half damage from [type]]]

### Skirmisher

[[[Name] M [4-6]/[10-12]/[6-8]/[6-8] HD8 HP30 w10
A+6 D+6 | Free sidestep after attacking | Adv A vs off-balanced]]

### Controller

[[[Name] M [4-6]/[6-8]/[10-12]/[8-10] HD10 HP35 w12
A+5 D+5 | On stance beat, apply condition×2 | 1/round, create battlefield effect]]

### Minion Swarm

[[[Name] Swarm L [4]/[8]/[6]/[4] HD6 HP25 w/
A+4 D+3 | Attacks all adjacent | Immune to single-target conditions]]

## Final Design Principles

**Make monsters that:**

1. **Force stance decisions** - No single stance should dominate
2. **Reward positioning** - The action phase should matter
3. **Create memorable moments** - Unique abilities players will remember
4. **Tell stories through mechanics** - Abilities reflect creature nature
5. **Scale with party tactics** - Challenge optimization without shutting it down

**Avoid monsters that:**

1. Only add numbers without decisions
2. Bypass the stance system entirely
3. Create un-fun lockdowns with no counterplay
4. Require excessive bookkeeping
5. Make combat drag without adding tension

Remember: Every monster is a tactical puzzle. The best encounters make players feel clever for solving them while keeping them on the edge of defeat. Design creatures that create stories, not just obstacles.
