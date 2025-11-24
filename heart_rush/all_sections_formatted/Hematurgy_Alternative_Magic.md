# Hematurgy: Alternative Magic System

**Setting Variant Rule**

This section presents Hematurgy, an alternative magic system for campaign settings where magic is powered by vitality rather than elemental attunement. In these settings, magic users are known as Hematurges or Sorcerers, and all magical effects require spending the caster's life force.

---

## Core Concept

Magic is used at the expense of the user's vitality—all magic is 'blood magic'. Practitioners are known as Hematurges or Sorcerers.

Practitioners of Hematurgy describe the feeling of using their abilities as similar to the way a plucked zither string might feel. You get used to it.

The moon seems to be related to Hematurgy, as Hematurgy is more likely to go wrong during a new moon. (Full Moon: Harder to do, easier to control. New Moon: Easier to do, harder to control. Mechanically no impact currently)

## Techniques

What are referred to in the standard Heart Rush rule set as handmagic or oaths are here referred to as **Techniques** (alternatively called Spells by some people in-game, but 'Techniques' will be used in this document).

In order to memorize Techniques, the user must either have the appropriate rank of the Blood Practitioner talent, or be a Sorcerer.

### Blood Practitioner

**Noncombat, Passive, Cognitive**

Gain the ability to use (memorize) basic, passive Techniques. You can take this talent multiple times, unlocking the next level of Techniques each time (passive < heart < major < weekly < monthly).

**Destiny Level:** You can gain the destiny level of passive Techniques. You can take this destiny level multiple times, unlocking the next level each time.

### Max HP Cost System

Using Techniques requires spending max HP. The max HP cost varies depending on the tier of the Technique, whether the user is a Sorcerer, and if so, their Sorcerer rank. Max HP spent on Techniques is recovered during a long rest. Max HP lost in this way does not inflict injuries.

Unless the user is a Sorcerer or a Demihuman, they cannot use a Technique if it would reduce them to 0 max HP (see Sorcerer section below, see Demihuman special trait in the character generation section).

Passive abilities' costs are paid per use of the ability.

### Technique Cost Table

| Frequency | Non-Sorcerer | Sorcerer Rank 1 | Rank 2 | Rank 3 | Rank 4 | Blood Fever Multiplier |
|-----------|--------------|-----------------|--------|--------|--------|------------------------|
| Passive   | 8            | 3               | 2      | 1      | 1      | 1                      |
| Heart     | 21           | 8               | 5      | 3      | 2      | 2                      |
| Major     | 34           | 13              | 8      | 5      | 3      | 3                      |
| Weekly    | 89           | 34              | 21     | 13     | 8      | 5                      |
| Monthly   | 144          | 55              | 34     | 21     | 13     | 8                      |

---

## Sorcerer Prestige Class

When you meet certain requirements, you can spend 5 + Current Sorcerer Rank XP to advance your sorcerer rank.

Sorcerers (or Hematurges) are those who have devoted a significant amount of time and effort to adapting their minds and bodies towards the very strenuous practice of Hematurgy. As such, they can learn and use Techniques more easily than others, as well as gain access to unique abilities.

Each Rank of Sorcerer has certain requirements that must be met before that rank can be taken, and each confers certain benefits. For the sake of these requirements, the basic level and the Destiny Level of a Technique each count as 1 separate Technique.

### Sorcerer Advancement Table

| Sorcerer Rank | Prerequisites | Flexible Technique | Condition Exchange |
|---------------|---------------|--------------------|--------------------|
| 1 | 5xp<br>BP Talent (25xp)<br>2 Techniques | - | 1/long rest;<br>3↔heart, 2↔passive |
| 2 | 6xp<br>25xp (50xp)<br>4 Techniques | 1x ≤ heart | 1/long rest;<br>3↔major, 2↔heart, 1↔passive |
| 3 | 7xp<br>80xp (100xp)<br>6 Techniques | 2x ≤ major | 2/long rest;<br>4↔weekly, 3↔major, 2↔heart, 1↔passive |
| 4 | 8xp<br>135xp (200xp)<br>8 Techniques | 2x ≤ weekly \| 1x ≤ DL of known talent | 2/long rest;<br>5↔monthly, 4↔weekly, 3↔major, 2↔heart, 1↔passive |

---

## Rank 1: Practiced

### Practiced

Sorcerers do not require the Blood Practitioner talent to memorize Techniques and may immediately exchange that talent (a prerequisite for this Path) for any Technique of Heart level or less.

Additionally, Sorcerers are able to learn Spell Techniques.

### Max HP Cost Reduction

Each rank of Sorcerer reduces the max HP cost of using Techniques by a set amount (per the table above).

### Blood Fever

If a Sorcerer would use a Technique and they are at 0 max HP, or using the Technique would reduce their max HP to 0, they gain a variable level aspect called **Blood Fever**. The rank of this aspect equals the max HP they could not pay. Further uses of Techniques increase this rank, rather than incurring another aspect, according to the max HP cost.

Blood Fever decreases max HP in the same way an injury does. It does not benefit from medical treatment; however, it decreases by 1 at the regular healing interval (1/successful long rest). However, any time a Technique is used while the Blood Fever aspect remains, there is an x% chance of worsening the rank (x = Blood Fever Level × Blood Fever Multiplier for the level of Technique used).

**Example:** Sorcerer rank 2, Current max HP at 20, using a Monthly Technique. The price for the technique is 34. 34-20=14. My max HP becomes 0 and I gain Blood Fever at rank 14. No further uses of Techniques, so aspect remains at 14. After a successful long rest, Blood Fever becomes rank 13. That day I use a major Technique. Blood Fever at rank 13, major Technique Blood Fever Multiplier of 3, 13×3=39% chance of worsening the injury. I roll a 25 on a d100, the aspect worsens to level 14.

### Nigashi Rose (Glimpse) Poisoning + Soul Bind

When a Sorcerer is afflicted with both Glimpse Poisoning and Soul Bind, their relationship with Hematurgy becomes unstable:

- Blood Fever recovers naturally 1/long rest
- Okunai pills (1/day), moonbathing (20 minutes), and godsblood (1/day) each speed recovery by 1
- Blood Fever will never disappear; minimum rank is 1 (4 for certain individuals)
- Continues to worsen as normal
- Hematurgy requires a Cunning check to use without destabilization
  - **DC = base 8 + BF Multiplier** (FINAL: 9, 10, 11, 13, 16)

**When using Hematurgy under these conditions:**

- **Choose to not roll the check:** Hematurgy succeeds. Blood Fever goes up by HP cost. Cost of all techniques increases by 1 step.

- **Fail the check - Choose 1:**
  - Hematurgy fails. Blood Fever goes up by failure difference.
  - Choose to succeed: Hematurgy succeeds. Blood Fever goes up by HP cost, and gain 1 level of mental or physical vulnerability which lasts until a successful long rest. Cost of all techniques increases by 1 step.

- **Succeed the check:** Hematurgy succeeds. Roll for Blood Fever increase as normal.

Technique costs return to normal after a long rest.

**If Max HP ever goes below zero as a result of Hematurgy, the Sorcerer destabilizes.**

#### Scaling Blood Fever DC

The base DC to use hematurgy without destabilizing increases by 1 for every 10 ranks of Blood Fever over 10.

**Examples:**
- BF20: base 9, FINAL: 10, 11, 12, 14, 17
- BF30: base 10, FINAL: 11, 12, 13, 15, 18

### Conditions

Rather than paying the max HP cost to use a Technique of heart frequency or less, once per long rest a Sorcerer may instead gain a random, leveled physical condition (weakened, off-balanced, dazed, shaken), levels determined by the Technique frequency. This condition is ongoing and can only be removed by taking a long rest, unless otherwise specified.

Condition levels cap at 5. If you would ever exceed 5 levels of any condition, you additionally gain a level of mental or physical vulnerability.

As your sorcerer rank improves, you can do this more frequently and with higher frequency Techniques.

---

## Rank 2: Flexible Techniques

Sorcerers may now take any talent (aside from Melodies) as a Technique, spending max HP the same way you would for any other Technique, at the frequency level of the talent. (Certain talents may be slightly altered for this. This might not work with all talents—the talent should include some kind of activation method to trigger the max HP cost.)

Additionally, once per long rest, a Sorcerer can choose a Technique (including spells) they have not memorized of heart frequency or less. Until your next long rest, you have access to that Technique (at the base frequency of the Technique—it cannot be upgraded). If the technique you choose has an ongoing effect, you must continue to choose that Technique to maintain the effect. The effect ends if you ever don't have access to that Technique.

As your Sorcerer rank improves, the frequency and options for this skill increase. Flexible Techniques do not count as memorized Techniques for the sake of improving Sorcerer rank.

---

## Rank 3: Potent Techniques

Sorcerers can increase the potency of their Techniques at the cost of additional max HP. When using a Technique, you can pay double the amount of max HP for one of the following effects:

- Increase the base range by 100%
- Increase the base duration by 100%
- Increase the base number of creatures affected by 100%
- Increase the level of Advantage or Disadvantage by 1

You can apply multiple effects to a single use of a Technique, doubling the cost each time.

---

## Rank 4: Advanced Mastery

### Flexible Techniques Upgrade

Rather than gaining access to up to two weekly frequency or less techniques that you don't know, until your next long rest, you can gain access to the Destiny Level of a technique you already know that you don't already have the Destiny Level for.

### Potent Techniques Upgrade

Rather than paying twice the max HP to increase an effect, you can pay the normal cost and drop a heart die.

**You also gain the following optional effect:**
- Apply the effect of a self-targeting Technique to an adjacent, willing creature you are touching.

---

## Paragon Level: Rank 5

**Requirements:** Sorcerer Rank 4; 15 Techniques, 5 of which must be Meridian or Savant abilities.

### Technique Cost Reduction
- Passive = 0
- Heart = 1
- Major = 2
- Weekly = 5
- Monthly = 8

### Flexible Techniques Upgrade

No longer restricted by frequency. Until the next time you long rest, you gain access to the basic level of up to two Techniques you don't already know, or the basic and Destiny Level of any one technique you don't already know, or the Destiny Levels of two techniques that you already know.

---

## Soulknife Subclass

**Open Subclass, Replaces Spelltouched**

SL = your Sorcerer Level

**Concept:** Pushing beyond ordinary limits for the sake of getting things done in combat. Storing and releasing negative energy—using their own worsening condition (both self and other-inflicted) and the 'chaos' of battle as a conduit for doing more, causing more havoc.

### Debaser - Rank 2 (passive)

Gain two basic Martial Techniques or the destiny level of one Technique. They do not count against the number of talents you have.

If you are currently in combat (i.e., initiative has been rolled and events are happening in turn order), you do not immediately reduce max HP when you use a Technique. Keep track of your total max HP spent on Techniques in a separate **Max HP Lost Pool**. You lose that amount of max HP once combat is over. If this reduces you to 0 max HP, gain or increase your Blood Fever level by the max HP you did not pay.

**If the amount of max HP in your Pool is ever greater than twice your Max HP, you die.**

### Gouge Away - Rank 3 (minor)

Reduce the damage you take from an incoming attack by half, adding the reduced amount to your Max HP Lost Pool. If the attack becomes less than 10 as a result of being halved, take a wound rank 5-SL (otherwise take a wound as normal).

### [I] Bleed - Rank 3 (minor)

**TBD** - Something that lets you spend (immediately take) the 'stored' damage [D] for minor but helpful effects. (increase speed for 1 round by 5×½D, add or subtract ½D×SL from roll (from any creature within 10 ft), change your stance after stances have been declared (costs as much as a weekly Technique? Costs 10-SL? no substitutions))

### Wave of Mutilation - Rank 4 (major)

Immediately reduce your max HP by the total amount of damage [TD] in your Max HP Lost Pool. Choose up to [2×SL] creatures you can see or hear and distribute [SL×TD] damage to them. This damage is applied to max HP. If this would reduce you to 0 max HP, you can choose to fall to 1 max HP instead and take the remainder as Blood Fever.

For every rush point spent on this ability, you can multiply both the damage you give and take by 0.25, rounded up. (4 rush points to double the damage)

**Example:** I'm SL 3 and have 40 points of damage in my Max HP Lost Pool. I lose 40 max HP, and can choose up to 6 [2×3] creatures I can see or hear and distribute 120 [3×40] points of damage between them. Since I have chosen to spend 4 rush points, I can instead lose 80 max HP and can distribute 240 points of damage between 6 targets.
