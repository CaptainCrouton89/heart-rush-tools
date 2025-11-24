# Investigation: Human Race Balance Analysis

**Date**: 2025
**Scope**: Comprehensive analysis of Human race abilities against balance guidelines
**File Analyzed**: `heart_rush/races/Human.md`

---

## Executive Summary

The Human race in Heart Rush contains **17 cultural subraces**, each with distinct abilities. Overall balance is **GENERALLY STRONG** with clear thematic identity and appropriate power levels. However, several specific concerns emerge:

1. **Human Resilience and Diversity** - Free talent selection is powerful but consistent with balance
2. **Potential duplications** - Skull Fusion overlaps heavily with Beastform talent
3. **Outlier abilities** - A few subrace abilities exceed typical ~2.5 damage equivalent or lack sufficient resource costs
4. **Clarity issues** - Some abilities need mechanical specification

---

## 1. SUMMARY OF ABILITIES

### Base Race Ability
**Human Resilience and Diversity** (Passive)
- Choose 1 talent as racial ability (doesn't count toward talent limit)
- Gain 1 rush point at start of next round after taking a wound

**Balance Assessment**: Matches design intent. References `RACE_BALANCE.md` example of "Free Talent" as valid racial mechanic.

---

### Subrace Abilities (17 total)

| Subrace | Ability Name | Type | Assessment |
|---------|-------------|------|------------|
| **Drachma** | Instinctive | Passive | Low power, niche utility |
| **Tikhaya** | Clear Mind | Passive | Moderate power, good niche |
| **Neth** | Speak with the Wind | Major | High narrative power, daily limit |
| **Oznak** | Technical Master | Passive | Matches talent complexity |
| **Vyanoweir** | Ancient Bloodline | Narrative | GM-negotiated, undefined |
| **Husakas** | Dust Dependency | Passive + Free Talent | Two-part ability, high power with cost |
| **The Guiltless** | Blessed Curse | Passive | Complex, mixed mechanics |
| **Qord'ik** | Strong Bones | Passive | Defensive ability, moderate power |
| **Shontobi** | Eagle Companion OR Honor Bound | Passive/Passive | One-per-character choice |
| **Tarnak** | Blood Sight | Major | Divination, daily limit |
| **Nuun** | Elemental Heritage | Passive + Free Talent | Two-part ability, high utility |
| **Temptari** | Temporal Awareness | Passive | Interrupt ability, high utility |
| **Kuru** | Skull Fusion | Major | Transformation, ongoing duration |
| **Shapers** | Perfect Mimicry | Major | Transformation, narrative-heavy |
| **Bledreon** | Dual-Lid Vision + Heat Endurance | Passive + Passive | Two abilities, defensive |
| **Gezzerin** | Giant-Dodger + Arid Endurance | Passive + Passive | Two abilities, utility |
| **Inavolin** | Griffin Bond OR Death from Above | Passive + Major | Tied abilities, one required choice |
| **Qindo** | Sea Legs + Charismatic Bargain | Passive + Minor | Two abilities, social focus |
| **Stone Men** | Stone Skin + Mountain Stride | Passive + Passive | Two abilities, environmental |
| **Wendi** | Lightning Resistance + Aerial Charge | Passive + Major | Two abilities, aerial focus |

---

## 2. BALANCE ASSESSMENT AGAINST GUIDELINES

### 2.1 Passive Abilities - Power Level Review

**COMPLIANT** (12 abilities):
- **Instinctive** (Drachma): +3 to reroll - Small, niche bonus ✓
- **Technical Master** (Oznak): Advantage on weapon OR A2 on tool - Matches talent tier ✓
- **Strong Bones** (Qord'ik): +2 wound threshold - Defensive, clear numeric ✓
- **Dual-Lid Vision** (Bledreon): Blindness immunity, A2 in harsh weather - Situational ✓
- **Heat Endurance** (Bledreon): Half water req, no heat penalties - Utility-focused ✓
- **Giant-Dodger** (Gezzerin): A2 stealth vs large, light obscuration - Niche tactical ✓
- **Arid Endurance** (Gezzerin): Dehydration immunity, half water req - Utility-focused ✓
- **Sea Legs** (Qindo): Ship stability, no prone/penalties - Niche utility ✓
- **Stone Skin** (Stone Men): +1 defense, 1d6 unarmed - Defensive, martial ✓
- **Mountain Stride** (Stone Men): No difficult terrain (rocky), altitude immunity - Utility ✓
- **Lightning Resistance** (Wendi): Half damage, stun immunity - Defensive, conditional ✓
- **Elemental Heritage** (Nuun): Basic attunement + advantage on presence - Hybrid utility ✓

**MODERATE POWER** (5 abilities):
- **Clear Mind** (Tikhaya): Immunity to 4 conditions + A2 on deception saves - **Stronger passive, but justified by niche**. Protects against major conditions.
- **Honor Bound** (Shontobi): Aspect bonus doubling + cheaper aspect XP - **Narrative-focused, enables playstyle without mechanical inflation**
- **Eagle Companion** (Shontobi): Free Beast Companion talent - **Matches Husakas pattern; see Free Talent analysis below**
- **Griffin Bond** (Inavolin): Lifelong flying mount with telepathy - **Complex, but clear mechanics and setup cost implied**
- **Temporal Awareness** (Temptari): Cannot be surprised + prevent nat-1s for allies - **FLAGGED: Interrupt ability is powerful, see section 2.3**

---

### 2.2 Major Abilities - Frequency Review

All Major abilities are **Daily** (long rest reset), aligning with guidelines.

**BALANCED**:
- **Speak with the Wind** (Neth): Q&A or dice replacement - Narrative powerful, 1 min ritual, once/day ✓
- **Blood Sight** (Tarnak): Divination about creature - Single piece of info, once/day ✓
- **Death from Above** (Inavolin): +2d6 aerial, D2 vs ground - Specific trigger (20ft height), mounted ✓
- **Aerial Charge** (Wendi): +3d6 aerial descent attack - Specific trigger (30ft descent), mounted ✓

**HIGH POWER / FLAGGED**:
- **Skull Fusion** (Kuru): Unlimited duration transformation - **See section 3.1 (Duplication) - overlaps Beastform**
- **Perfect Mimicry** (Shapers): Physical transformation, fool magical detection - **High narrative power but few mechanical combat benefits; balanced by limitations (1 min cast, silver eyes)**
- **Honor Bound** upgrade path - Actually a Passive; see 2.1

---

### 2.3 Minor Abilities - Resource Cost Review

Only **1 Minor ability** exists:
- **Charismatic Bargain** (Qindo): 1 RP spend for A2 on presence check - **Compliant, social focus**

---

### 2.4 Free Talents Analysis

**Five subraces grant free talents:**

1. **Human Resilience and Diversity** - Choose any talent (base race)
2. **Husakas** - Any handmagic talent (Dust Dependency part 2)
3. **Nuun** - Basic elemental attunement (Elemental Heritage part 2)
4. **Shontobi** - Beast Companion talent (Eagle Companion)
5. **Inavolin** - Implied warhorse-equivalent mount (Griffin Bond)

**Assessment**: Aligns with `RACE_BALANCE.md` stating "Free Talent" is valid racial mechanic. **However**, distribution is uneven:
- Some races get 1 free talent + modest ability
- Others (Bledreon, Gezzerin, Stone Men, Wendi) get **2 standalone passive abilities** instead

**Potential concern**: Characters with two passive abilities (Bledreon, Gezzerin, Stone Men, Wendi) may have more character-building flexibility than those with a free talent + passive.

---

## 3. DUPLICATE & OVERLAP ANALYSIS

### 3.1 CRITICAL: Skull Fusion (Kuru) vs Beastform (Talent)

**Skull Fusion** (line 258-268):
```
Major ability. Transform into beast form with GM approval.
- Maintain mental stats, gain physical stats
- Cannot speak/cast verbal spells
- Lasts until long rest or end action
- Each long rest transformed = might save (CN 10) or gain mental vulnerability
- CAN STAY INDEFINITELY (unlike Beastform)
```

**Beastform Talent** (Noncombat talent):
```
Major ability. Transform into single mundane creature.
- Maintain mental stats, gain physical stats
- Cannot have fly/swim (base) or tiny size
- Automatically reverts after 1 hour OR action to end
- Destiny Level: Passive, unlimited duration, fly/swim allowed, tiny size
```

**Duplication Assessment**: ⚠️ **SIGNIFICANT OVERLAP**
- Base Beastform = limited duration transformation
- Skull Fusion = unlimited duration with mental degradation cost
- Destiny Beastform = unlimited duration transformation without degradation
- **Problem**: Skull Fusion is essentially "Beastform but with a Might save instead of class cost"
- **Kuru is a subrace** (should have unique flavor), but the mechanical advantage over Beastform Destiny is unclear

**Recommendation**: Reframe Skull Fusion as:
- Different beast pool (predators, legendary beasts vs mundane creatures)
- Different activation (ritual with skull object vs action)
- Different cost (mental degradation vs XP)
- OR make clear it's a flavor alternative with same constraints

---

### 3.2 Eagle Companion & Griffin Bond vs Beast Companion Talent

**Eagle Companion** (Shontobi):
- Grants Beast Companion talent as racial ability
- "Particularly intelligent, delivers messages"

**Griffin Bond** (Inavolin):
- Free griffin mount (warhorse stats + fly 80 ft)
- Telepathic link, can summon, A2 on aerial checks

**Beast Companion Talent**:
- Choose small/tiny animal (d6/d4/d2/d2 stats)
- 20 HP capacity, d6 heart die
- Cannot enter engagements autonomously
- Can be taken multiple times

**Assessment**: ✓ **NO DUPLICATION** - Each is distinct:
- Beast Companion = versatile, can be taken multiple times
- Eagle Companion = flavored companion, single eagle with message delivery
- Griffin Bond = powerful mount with combat utility and mobility

---

### 3.3 Free Talent Consistency Check

Comparing **free talent grants**:

| Grant | Type | Source | Balance Implication |
|-------|------|--------|-------------------|
| Any talent | Open-ended | Human Resilience | Allows optimization; player choice |
| Handmagic | Restricted | Husakas (Dust Dependency) | Thematic lock; cost = dust addiction |
| Elemental attunement | Restricted | Nuun (Elemental Heritage) | Thematic lock; split with attunement choice |
| Beast Companion | Restricted | Shontobi (Eagle Companion) | Thematic lock; replaces talent choice |
| None explicit | Implied | Inavolin (Griffin Bond) | Implied as part of bond, not separate talent |

**Assessment**: ⚠️ **MODERATE CONSISTENCY ISSUE**
- Human Resilience (base) = most powerful (any talent)
- Others are restricted by theme = appropriate tradeoff
- **However**: Inavolin doesn't clarify if Griffin Bond includes "a free warhorse talent" or is purely a stat block

---

## 4. SPECIFIC CONCERNS & RECOMMENDATIONS

### 4.1 🔴 HIGH PRIORITY

#### A. Temporal Awareness Interrupt Mechanic (Temptari)

**Text** (line 245):
> "Once per round, when you or an ally within 30 feet would roll a 1 on any die, you may warn them. They may choose to not take that action instead."

**Issues**:
1. **Ambiguous scope**: Does "any die" include defense rolls? Attack rolls only? Saving throws?
2. **Powerful interrupt**: Preventing complications (rolling 1s) is very powerful
3. **Allies within 30 ft**: No action cost, no resource cost - essentially free accident prevention
4. **Per-round limit**: Only once/round prevents spam, but interaction with multi-target scenarios is unclear

**Concern**: This effectively grants **D2 on complications** to self + all allies nearby, with no resource cost. Compare to talents:
- Most Passive abilities grant +1/+2 or advantage (situational)
- This grants advantage on preventing failures, always active, multicast

**Recommendation**:
- Clarify "any die" scope (suggest: attack/check/save rolls only, not defense)
- Add resource cost (1 RP per use?) OR
- Limit to self only OR
- Change to "you can sense impending danger" (perception) without preventing the action

---

#### B. Skull Fusion Duration vs Beastform (Kuru)

**Current Discrepancy**:
- Beastform talent = reverts after 1 hour base, unlimited at Destiny
- Skull Fusion = "indefinite but Might save each long rest for mental vulnerability"

**Issue**: Why take Beastform (costs XP) when Skull Fusion (racial, free) offers unlimited duration with a save instead of class penalty?

**Recommendation**:
- **Option 1**: Cap Skull Fusion at same 1 hour, OR longer ritual requirement (8 hours?)
- **Option 2**: Make the Might save automatic failure on 2+ mental vulnerabilities (escalating cost)
- **Option 3**: Specify Skull Fusion grants access to "legendary/rare beasts" that Beastform cannot (flavor distinction)

---

#### C. Blessed Curse Mechanic Clarity (The Guiltless)

**Text** (lines 141-146):
- Cannot lie, steal, harm sentient creatures (automatic fail)
- Advantage on saves vs hostile magic
- D2 on attack rolls against you
- Once per day: Compel truthful answer

**Issues**:
1. **"Automatically fails any attempt to harm"**: Does this mean:
   - All attack rolls miss? (seems strong)
   - Attack rolls fail but penalties apply?
   - Only intentional harm fails, but accidents/self-defense are okay?
2. **"Universe conspires"**: Is the D2 penalty on attackers mechanical or flavor?
3. **Advantage on saves vs hostile magic**: How does this interact with other advantage sources?
4. **Truthful answer compulsion**: Is there a save to resist? (not stated)

**Recommendation**: Rewrite with explicit mechanics:
- "Your attacks against sentient creatures automatically miss, you cannot intentionally harm them" (clear limitation)
- "Creatures attacking you have D2 on attack rolls" (mechanical)
- "You have advantage on saves against hostile magic" (clear)
- "Once per day, target creature makes a Cunning save (CN 10) or must answer your question truthfully" (add save clause)

---

### 4.2 🟡 MEDIUM PRIORITY

#### A. Husakas Dust Addiction Flavor vs Mechanics

**Text** (lines 121-127):
- Gain handmagic talent
- Must consume dust daily
- More than 1 week without = all mental conditions gained simultaneously

**Concern**:
1. Imposing all mental conditions (confused, frightened, aggravated, charmed) at once is **extremely punitive**
2. One-level gain of all four simultaneously exceeds any other racial penalty
3. "Yearly replenishment" suggests expedition/pilgrimage but unclear if mechanical requirement

**Recommendation**:
- Clarify: Does "all mental conditions" mean confusion + frightened + aggravated + charmed (4 separate conditions) or shorthand for "major mental debuff"?
- If it's 4 conditions: **Reduce to 2 conditions or 2 levels of one condition** to match penalty severity
- Clarify pilgrimage/trade as flavor, not mechanical requirement

---

#### B. Ancient Bloodline Undefined (Vyanoweir)

**Text** (lines 104-106):
> "Work with your GM. This culture is nearly gone."

**Concern**:
- Only subrace without defined mechanics
- Suggests "negotiate with GM" (open-ended)
- Could lead to power creep if player/GM negotiate "fading echoes of power"

**Recommendation**:
- Provide a default ability (e.g., "Speak with the Ancestors" parallel to Neth)
- Or remove and designate Vyanoweir as "narrative only, no mechanical benefits"
- Document the negotiation boundaries

---

#### C. Perfect Mimicry Duration & Action Economy

**Text** (lines 283-289):
- 1 minute transformation time
- Lasts until change/revert
- Retains abilities, no knowledge/memories

**Concern**:
- 1 minute cast = unusable in combat
- Unlimited duration = can maintain disguise indefinitely
- No resource cost (not even limited uses/day)
- Combines with "no magical detection" for potential abuse

**Recommendation** (if this is intended power level):
- Clarify: Can you maintain multiple simultaneous forms? (assume: no, one at a time)
- Add: "If you haven't spoken to anyone knowing your true identity for 1 month, you must make a Cunning save (CN 12) or forget which form is your original"
- Or add: "You can maintain this form for up to [X days] before needing to revert for 24 hours to recover identity"

---

### 4.3  🟢 LOW PRIORITY / CLARIFICATIONS

#### A. Instinctive Reroll Bonus (Drachma)

**Current**: +3 to new roll after complication on skill check

**Assessment**: Balanced but clarify:
- Does the original roll count toward the "new result" (i.e., replace the 1 with 1+3 = 4)?
- Or is it a completely separate roll where you add 3 after rolling?

---

#### B. Clear Mind Condition List (Tikhaya)

**Current**: "Immune to confused, frightened, aggravated, charmed"

**Assessment**: Good but note that:
- These are the four mental conditions in Heart Rush
- Consider clarifying: "You cannot be confused, frightened, aggravated, or charmed"

---

#### C. Speak with the Wind Ritual (Neth)

**Current**: "Ritual takes 1 minute"

**Assessment**: Clarify if this blocks other actions or is passive. Assume: Uses full 1 minute action, during which character cannot move/act (standard ritual).

---

#### D. Qord'ik Size Classification (Qord'ik)

**Text** (line 164-166):
> "Count as one size larger for carrying capacity" but vitals list Medium size

**Assessment**: Clarify:
- Are they still Medium-size for squeezing/grappling purposes?
- Or are they treated as Large for all purposes except weapon sizing?
- Recommend: "You count as one size larger for carrying capacity and athletics checks, but remain Medium for creature abilities and grappling"

---

## 5. COMPARATIVE POWER ANALYSIS

### 5.1 Free Talent Distribution

**Subraces with Free Talents/Extra Abilities**:

```
Highest Power (Free Talent + Major):
- Husakas (Dust Dependency): Free handmagic talent + penalty
- Shontobi (Eagle Companion): Free Beast Companion talent (choice-gated with Honor Bound)
- Inavolin (Griffin Bond): Free mount + Major (Death from Above)

Moderate Power (Free Talent or Major only):
- Human Resilience (base): Free talent choice (any)
- Nuun (Elemental Heritage): Free basic attunement
- Neth (Speak with Wind): Major ability
- Kuru (Skull Fusion): Major ability

Lower Power (Passive only, may be 2x):
- All other subraces

```

**Observation**: The "two passive abilities" subraces (Bledreon, Gezzerin, Stone Men, Wendi) have **less character-building flexibility** than free-talent subraces but similar total power. This is intentional thematic design (environmental/specialized).

---

### 5.2 Combat Ability Power Budget

**Rough Combat Damage Equivalents** (per balance guide ~2.5 damage/round baseline):

| Ability | Type | Damage/Round Equivalent | Notes |
|---------|------|------------------------|-------|
| Technical Master | Passive | +1-2 | Advantage = ~+2 damage with weapon |
| Strong Bones | Passive | +2 | Defensive (wound threshold +2) |
| Stone Skin | Passive | +1 | Defense +1 = ~+0.5 effective HP |
| Lightning Resistance | Passive | 1-2 | Conditional on enemy attack type |
| Death from Above | Major | +2d6 = +7 | Conditional trigger (20 ft height) |
| Aerial Charge | Major | +3d6 = +10.5 | Conditional trigger (30 ft descent) |
| Charismatic Bargain | Minor | +2 (social) | Non-combat focused |

**Assessment**: ✓ All combat abilities fall within 2.5-10 damage range, appropriate to ability type.

---

## 6. SUMMARY TABLE: ALL SUBRACES

| Subrace | Ability | Type | Power Level | Concern Level | Notes |
|---------|---------|------|-------------|----------------|-------|
| Drachma | Instinctive | Passive | Low | 🟢 | Minor clarification on reroll mechanic |
| Tikhaya | Clear Mind | Passive | Moderate | 🟢 | Balanced, conditional immunity |
| Neth | Speak with Wind | Major | High | 🟢 | Thematic, narrative power appropriate |
| Oznak | Technical Master | Passive | Low-Moderate | 🟢 | Matches talent tier |
| Vyanoweir | Ancient Bloodline | Special | Undefined | 🟡 | No mechanics defined, needs defaults |
| Husakas | Dust Dependency | Passive + Free Talent | High | 🟡 | Mental condition penalty too severe? |
| Guiltless | Blessed Curse | Passive | Moderate-High | 🔴 | Mechanics need explicit clarification |
| Qord'ik | Strong Bones | Passive | Moderate | 🟢 | Clear, balanced |
| Shontobi | Eagle Companion / Honor Bound | Passive + Passive | Moderate-High | 🟢 | Choice-gated, thematic |
| Tarnak | Blood Sight | Major | Moderate | 🟢 | Divination, balanced |
| Nuun | Elemental Heritage | Passive + Free Talent | High | 🟢 | Thematic, attunement + presence |
| Temptari | Temporal Awareness | Passive | High | 🔴 | Interrupt mechanic too powerful/unclear |
| Kuru | Skull Fusion | Major | High | 🔴 | Duplicates Beastform, duration unclear |
| Shapers | Perfect Mimicry | Major | Moderate | 🟡 | Duration/abuse potential needs bounds |
| Bledreon | Dual-Lid Vision + Heat Endurance | Passive + Passive | Moderate | 🟢 | Environmental, balanced |
| Gezzerin | Giant-Dodger + Arid Endurance | Passive + Passive | Moderate | 🟢 | Environmental, balanced |
| Inavolin | Griffin Bond / Death from Above | Passive + Major | High | 🟡 | Aerial focus clear, but mount balance ambiguous |
| Qindo | Sea Legs + Charismatic Bargain | Passive + Minor | Moderate | 🟢 | Social/nautical, balanced |
| Stone Men | Stone Skin + Mountain Stride | Passive + Passive | Moderate | 🟢 | Martial/environmental, balanced |
| Wendi | Lightning Resistance + Aerial Charge | Passive + Major | High | 🟢 | Aerial focus, combat balanced |

---

## 7. RECOMMENDATIONS SUMMARY

### Critical Fixes Required

1. **Temporal Awareness (Temptari)**: Clarify interrupt scope, add resource cost or limit
2. **Skull Fusion (Kuru)**: Reframe vs Beastform or add mechanical distinction
3. **Blessed Curse (Guiltless)**: Explicitly define attack failure, compulsion save

### Important Clarifications

4. **Husakas Dust Addiction**: Reduce simultaneous conditions or clarify as single multi-condition
5. **Ancient Bloodline (Vyanoweir)**: Provide default mechanics or explicit narrative-only designation
6. **Perfect Mimicry (Shapers)**: Add duration bounds or monthly reset

### Minor Clarifications

7. **Instinctive (Drachma)**: Clarify reroll addition mechanic
8. **Qord'ik Size**: Clarify size interactions (Medium vs Large purposes)

---

## 8. CONCLUSION

**Overall Assessment**: ✅ **GENERALLY WELL-BALANCED**

The Human race provides:
- ✓ Strong thematic variety across 17 subraces
- ✓ Appropriate power levels (mostly 2.5-7 damage equivalent)
- ✓ Clear niche protection (environmental, aerial, social, martial)
- ✓ Resource-gating where appropriate (daily limits, RP costs)

**Issues are localized** to 3-4 abilities that need mechanical clarification or reframing. No systemic balance problems that would require redesign.

**Recommendation**: Address critical fixes (#1-3) before release, then review playtesting data.
