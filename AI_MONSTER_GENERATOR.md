# AI Monster Generator

## Overview

AI-powered tool that generates custom monster stat blocks for Heart Rush campaigns using OpenAI's GPT models. Provides GMs with balanced, game-appropriate creatures based on simple concept descriptions, with proper stat blocks and markdown export functionality.

## How It Works

1. **Concept Analysis**: GPT-4.1-nano analyzes user input to determine monster level and complexity
2. **Stat Generation**: GPT-4.1 generates complete monster stat block using structured schema
3. **Validation**: Zod schema validates all generated stats for game balance
4. **Formatting**: Results displayed as formatted stat block with copy-to-clipboard functionality
5. **Export Options**: Generated monsters can be copied as markdown for external use

## Key Files

- **`src/app/tools/monster-generator/page.tsx`** - Main monster generator interface
- **`src/app/tools/monster-generator/components/ConceptForm.tsx`** - Input form component
- **`src/app/tools/monster-generator/components/MonsterStatBlock.tsx`** - Stat block display
- **`src/app/tools/monster-generator/types.ts`** - TypeScript interfaces for monster data
- **`src/app/tools/monster-generator/utils.ts`** - Utility functions for formatting
- **`src/app/api/ai/generate-monster/route.ts`** - API endpoint for monster generation
- **`src/app/tools/page.tsx`** - Tools overview page

## Monster Generation Pipeline

### Step 1: Concept Analysis

```typescript
// Uses GPT-4.1-nano for fast concept analysis
const enhancedConcept = await generateText({
  model: openai("gpt-4.1-nano"),
  temperature: 0.3,
  system: `Analyze monster concept and determine level/complexity...`,
});
```

### Step 2: Stat Block Generation

```typescript
// Uses GPT-4.1 with structured schema for full generation
const { object } = await generateObject({
  model: openai("gpt-4.1"),
  schema: monsterSchema,
  temperature: 0.5,
  system: `Generate balanced monster statblock...`,
});
```

## Monster Schema

### Core Statistics

```typescript
interface Monster {
  name: string;
  description: string;
  size: "tiny" | "small" | "medium" | "large" | "huge";
  type: string;
  abilities: {
    might: Die;
    agility: Die;
    cunning: Die;
    presence: Die;
  };
  heartDie: Die;
  hp: number;
  woundThreshold: number | null;
  attack: AttackDefenseBonus;
  defense: AttackDefenseBonus;
  movement: Movement;
  talents: Talent[];
  attacks: Attack[];
  special_abilities?: SpecialAbility[];
  lore?: string;
}
```

### Die System

```typescript
interface Die {
  sides: 4 | 6 | 8 | 10 | 12 | 20;
  modifier?: number;
}
```

### Talent System

```typescript
interface Talent {
  name: string;
  description: string;
  type?: "combat" | "noncombat" | "passive";
  cooldown?: string;
}
```

## Monster Complexity Levels

### Basic Creature

- **Examples**: Simple animals, weak undead, common minions
- **Stats**: Low dice (d4-d6), basic attacks, minimal talents
- **HP Range**: 20-40
- **Talents**: 0-2 simple talents

### Skilled Opponent

- **Examples**: Trained soldiers, experienced predators, minor demons
- **Stats**: Medium dice (d6-d8), multiple attacks, several talents
- **HP Range**: 40-80
- **Talents**: 2-4 talents with some complexity

### Elite Adversary

- **Examples**: Champions, lieutenants, powerful monsters
- **Stats**: High dice (d8-d10), complex abilities, many talents
- **HP Range**: 80-120
- **Talents**: 4-6 talents with special mechanics

### Legendary Foe

- **Examples**: Dragons, demon lords, campaign bosses
- **Stats**: Legendary dice (d10-d12), unique abilities, extensive talents
- **HP Range**: 120+
- **Talents**: 6+ talents with unique mechanics

## User Interface

### Concept Input Form

- **Simple Text Area**: Users describe monster concept in natural language
- **Example Prompts**: Helpful examples to guide user input
- **Validation**: Basic input validation before submission
- **Loading States**: Progress indicators during generation

### Generated Stat Block Display

- **Formatted Layout**: Professional stat block formatting
- **Heart Rush Styling**: Game-appropriate visual design
- **Interactive Elements**: Clickable abilities and attacks
- **Copy Functionality**: One-click copying of entire stat block

### Export Options

- **Markdown Format**: Properly formatted markdown for external tools
- **Clipboard Integration**: Direct copy-to-clipboard functionality
- **Print Styles**: Optimized formatting for printing
- **Share URLs**: Shareable links for generated monsters

## AI Prompt Engineering

### Concept Analysis Prompt

```
You analyze monster concepts and determine their level and complexity.
Respond with format:
LEVEL: [level]
ABILITIES: [number]
DESCRIPTION: [brief description]

Monster levels:
- "basic creature" - Simple animals, weak undead
- "skilled opponent" - Trained soldiers, experienced predators
- "elite adversary" - Champions, lieutenants, powerful monsters
- "legendary foe" - Dragons, demon lords, campaign bosses
```

### Generation System Prompt

```
You are an expert at creating monsters for the Heart Rush TTRPG system.
Generate balanced, interesting monster statblocks that follow the
game's design principles and match the complexity of the input.

# Heart Rush Design Principles
- Monsters should feel distinct and memorable
- Abilities should create interesting tactical decisions
- Stats should be balanced for their intended level
- Special abilities should reflect the creature's nature
```

## Game Balance Guidelines

### Stat Allocation

- **Ability Dice**: Scale appropriately with monster level
- **Hit Points**: 40 is considered "average" for most encounters
- **Wound Thresholds**: Null for unwoundable creatures, 1-10 for others
- **Attack/Defense**: Balanced bonuses that scale with level

### Talent Selection

- **Combat Talents**: Direct combat effectiveness
- **Utility Talents**: Out-of-combat or special situation abilities
- **Passive Abilities**: Always-on effects that define the creature
- **Unique Mechanics**: Special rules that make the monster memorable

### Attack Design

- **Primary Attacks**: Main offensive options
- **Secondary Attacks**: Situational or special attacks
- **Damage Scaling**: Appropriate damage for monster level
- **Special Effects**: Conditions, forced movement, or unique mechanics

## Error Handling

### API Errors

- **OpenAI Failures**: Graceful fallbacks and retry mechanisms
- **Rate Limiting**: Appropriate handling of API rate limits
- **Network Issues**: Timeout handling and user feedback
- **Invalid Responses**: Validation and error reporting

### Validation Errors

- **Schema Validation**: Zod schema ensures proper stat block structure
- **Game Rule Validation**: Checks for impossible stat combinations
- **User Input Validation**: Prevents malformed or empty requests
- **Fallback Handling**: Default values for missing or invalid data

## Performance Optimizations

### Response Time

- **Two-Stage Generation**: Fast concept analysis followed by detailed generation
- **Model Selection**: Optimized model choices for each stage
- **Temperature Settings**: Balanced creativity vs consistency
- **Caching**: Future implementation of result caching

### User Experience

- **Progress Indicators**: Clear feedback during generation process
- **Instant Validation**: Client-side input validation
- **Optimistic Updates**: UI updates before API confirmation
- **Error Recovery**: Clear error messages and retry options

## Security Considerations

### API Protection

- **Rate Limiting**: Server-side request throttling
- **Input Sanitization**: Cleaning user input before API calls
- **API Key Security**: Secure handling of OpenAI credentials
- **Error Information**: Limited error details to prevent information leakage

### User Data

- **No Persistence**: Generated monsters not stored server-side
- **Client-Side Only**: All generation happens in user session
- **No Personal Data**: No collection of user information
- **Privacy Focused**: Minimal data exposure and processing

## Future Enhancements

### Planned Features

- **Monster Collections**: Save and organize generated monsters
- **Campaign Integration**: Direct import into campaign management tools
- **Batch Generation**: Generate multiple related monsters
- **Template System**: Pre-built monster templates for common types

### AI Improvements

- **Fine-tuned Models**: Custom models trained on Heart Rush content
- **Better Balancing**: Advanced stat validation and balancing
- **Style Consistency**: More consistent generation style and quality
- **Contextual Generation**: Generate monsters for specific scenarios

## Development Notes

- Requires OpenAI API key configured in environment
- Only available to users in GM mode
- Built with Vercel AI SDK for OpenAI integration
- Uses Zod for runtime type validation and schema enforcement
