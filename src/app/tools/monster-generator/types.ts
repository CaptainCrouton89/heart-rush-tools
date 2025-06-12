export type Die = "d4" | "d6" | "d8" | "d10" | "d12" | "d20";
export type Size = "S" | "M" | "L" | "L2" | "L3" | "L4" | "L5" | "L6" | "L7" | "L8";

export interface Abilities {
  might: Die;
  agility: Die;
  cunning: Die;
  presence: Die;
}

export interface ConditionalBonus {
  condition: string;
  bonus: number;
}

export interface AttackDefense {
  base?: number;
  byDamageType?: {
    slashingPiercing?: number;
    bludgeoning?: number;
    other?: Record<string, number>;
  };
  conditional?: ConditionalBonus[];
}

export interface Save {
  type: "MC" | "AC" | "CC" | "PC";
  dc: number;
}

export interface SpecialAbility {
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

export interface Movement {
  cannotBePushed?: boolean;
  speed?: number;
  special?: string[];
}

export interface Phase {
  trigger: string;
  changes: string[];
}

export interface Aura {
  name: string;
  range: string;
  effect: string;
  save?: Save;
}

export interface Mechanics {
  engagementsPerRound?: number;
  phases?: Phase[];
  auras?: Aura[];
}

export interface BaseMonster {
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

export interface Component extends BaseMonster {
  quantity?: number;
  shared?: boolean;
}

export interface MonsterStatBlock extends BaseMonster {
  components?: Component[];
}