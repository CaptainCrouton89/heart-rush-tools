# Content Combination Investigation - Complete Index

## Overview

This investigation documents how the Heart Rush content compilation system combines individual files into super-documents. The pattern allows maintaining organized source files while creating hierarchical documents for processing.

**Investigation Date:** November 24, 2025
**Focus:** File combination patterns for races, talents, and world wikis
**Application:** Implementing daemon file combination for Alaria

---

## Quick Start

**If you want a quick reference:** Start with `FILE_COMBINATION_QUICK_REFERENCE.txt`

**If you want implementation steps:** Read `docs/investigations/alaria-daemon-implementation-guide.md`

**If you want to understand the pattern:** Read `CONTENT_COMBINATION_PATTERNS.md`

**If you want detailed code examples:** Read `docs/investigations/file-combination-code-patterns.md`

---

## Document Overview

### 1. QUICK REFERENCE (This Repo Root)
**File:** `FILE_COMBINATION_QUICK_REFERENCE.txt` (4 KB)

A concise text reference covering:
- Three main patterns with algorithms
- Code patterns and examples
- Key code locations with line numbers
- Integration with compilation pipeline
- How to apply to daemons
- Testing checklist

**Start here if:** You need a quick lookup of how something works

---

### 2. PATTERN GUIDE (This Repo Root)
**File:** `CONTENT_COMBINATION_PATTERNS.md` (6 KB)

A visual guide covering:
- Pattern in plain English
- Three pattern types with flow diagrams
- Code locations and purposes
- Design principles
- Common implementation checklist
- Troubleshooting guide

**Start here if:** You want to understand design decisions

---

### 3. SUMMARY (docs/investigations/)
**File:** `SUMMARY.md` (7 KB)

Executive summary containing:
- What you found (30-second explanation)
- Specific examples (races, talents, world wiki)
- How to apply for daemons
- Key files summary
- Why the pattern works
- Next steps

**Start here if:** You want a high-level overview

---

### 4. COMPREHENSIVE INVESTIGATION (docs/investigations/)
**File:** `content-combination-pattern.md` (12 KB)

Detailed investigation including:
- Goal and executive summary
- Two-stage compilation process
- Pattern details for races (structure, logic, result)
- Pattern details for talents (structure, logic, result)
- World wiki pattern already used for Alaria
- How content processing handles combined files
- Recommendations for daemon files
- Critical implementation details
- Integration points and code locations

**Start here if:** You want complete context and rationale

---

### 5. CODE REFERENCE (docs/investigations/)
**File:** `file-combination-code-patterns.md` (16 KB)

Complete code examples including:
- Race combination pattern with full code
- Talent combination pattern with full code
- World wiki pattern with full code
- How each integrates with main compilation
- Flow diagram showing data transformation
- Pattern template for new combinations

**Start here if:** You need to write or modify combination code

---

### 6. IMPLEMENTATION GUIDE (docs/investigations/)
**File:** `alaria-daemon-implementation-guide.md` (11 KB)

Step-by-step guide for daemons including:
- Problem statement and solution options
- Recommended implementation (separate subdirectory)
- Exact file changes needed
- How it works behind the scenes
- File naming recommendations
- Alternative implementation
- Implementation checklist
- Testing procedures
- Troubleshooting guide
- Related code files

**Start here if:** You're ready to implement daemons combination

---

## The Patterns at a Glance

### Pattern 1: Simple Combination (Races)
```
Individual files (60+) → combineRaceFiles() → Kin_&_Culture.md → Processing
```
**Files:** Each starts with ## header
**Combination:** Linear append
**Location:** scripts/lib/file-combiners.ts:20-67

### Pattern 2: Multi-Section Combination (Talents)
```
Multiple directories → combineTalentFiles() → Talents.md → Processing
(combat_talents + noncombat_talents + spells)
```
**Files:** Multiple subdirectories
**Combination:** Section headers + header adjustment
**Location:** scripts/lib/file-combiners.ts:69-227

### Pattern 3: Recursive World Wiki Combination
```
Category with nested files → combineWorldWikiCategory() → Category.md → Processing
```
**Files:** Recursively collected from subdirectories
**Combination:** Headers from filenames
**Location:** scripts/lib/file-combiners.ts:256-309
**Used for:** Alaria (nations, atlas, dramatis_personae, bestiary)

---

## How to Apply This Knowledge

### If you need to add daemon combination:
1. Read: `alaria-daemon-implementation-guide.md`
2. Follow: Step-by-step implementation section
3. Edit: One line in `file-combiners.ts`
4. Run: `pnpm run compile-content`
5. Check: Testing section

### If you need to understand the code:
1. Read: `CONTENT_COMBINATION_PATTERNS.md`
2. Reference: `FILE_COMBINATION_QUICK_REFERENCE.txt`
3. Study: `file-combination-code-patterns.md` for specific pattern

### If you need to extend for new content:
1. Read: `content-combination-pattern.md` for rationale
2. Study: `file-combination-code-patterns.md` for code
3. Check: Code locations table for where to make changes

### If you need to troubleshoot:
1. Check: Testing checklist in quick reference
2. Read: Troubleshooting section in implementation guide
3. Verify: Code locations match your changes

---

## Key Code Files in Source

| File | Lines | Purpose |
|------|-------|---------|
| `scripts/lib/file-combiners.ts` | 339 | All combination functions |
| `scripts/compile-content.ts` | 601 | Main compilation orchestrator |
| `scripts/lib/content-processors.ts` | ~500 | Splits combined docs |
| `scripts/lib/navigation-builder.ts` | ~300 | Builds hierarchy |

## Key Functions

| Function | File | Lines | Purpose |
|----------|------|-------|---------|
| `combineRaceFiles()` | file-combiners.ts | 20-67 | Races → super-doc |
| `combineTalentFiles()` | file-combiners.ts | 69-227 | Talents → super-doc |
| `combineWorldWikiCategory()` | file-combiners.ts | 256-309 | Category → super-doc |
| `combineWorldWikiFiles()` | file-combiners.ts | 311-339 | Orchestrate categories |
| `compilePlayerContent()` | compile-content.ts | 42-199 | Heart Rush pipeline |
| `compileWorldWiki()` | compile-content.ts | 333-531 | World wiki pipeline |
| `splitContent()` | content-processors.ts | (imported) | Super-doc → sections |

---

## Investigation Questions Answered

1. **How do races combine?**
   - See: `file-combination-code-patterns.md` Pattern 1
   - Or: `CONTENT_COMBINATION_PATTERNS.md` Pattern 1

2. **How do talents combine?**
   - See: `file-combination-code-patterns.md` Pattern 2
   - Or: `CONTENT_COMBINATION_PATTERNS.md` Pattern 2

3. **How do world wikis combine?**
   - See: `file-combination-code-patterns.md` Pattern 3
   - Or: `content-combination-pattern.md` World Wiki Pattern

4. **How is combination integrated with processing?**
   - See: `file-combination-code-patterns.md` Integration section
   - Or: `CONTENT_COMBINATION_PATTERNS.md` Integration section

5. **How can I add daemon combination?**
   - See: `alaria-daemon-implementation-guide.md` (complete guide)
   - Quick version: Add "daemons" to WORLD_WIKI_COMBINABLE_DIRS

6. **Why use this pattern?**
   - See: `CONTENT_COMBINATION_PATTERNS.md` Design Principles
   - Or: `content-combination-pattern.md` Key Points

---

## Directory Structure

```
/Users/silasrhyneer/Code/heart-rush-tools/

Root Level (Quick Reference):
├── FILE_COMBINATION_QUICK_REFERENCE.txt    ← Start here (text format)
├── CONTENT_COMBINATION_PATTERNS.md         ← Start here (markdown)
├── INVESTIGATION_INDEX.md                  ← This file
│
docs/investigations/ (Detailed Documentation):
├── SUMMARY.md                              ← 30-second overview
├── content-combination-pattern.md          ← Comprehensive investigation
├── file-combination-code-patterns.md       ← Code examples
├── alaria-daemon-implementation-guide.md   ← How-to guide
│
Source Code (Implementation):
├── scripts/lib/file-combiners.ts           ← Combination functions
├── scripts/compile-content.ts              ← Orchestrator
├── scripts/lib/content-processors.ts       ← Processing
├── scripts/lib/navigation-builder.ts       ← Navigation

Example Content:
├── heart_rush/races/                       ← Individual race files
├── heart_rush/talents/                     ← Individual talent files
├── world-wikis/alaria/bestiary/            ← Individual creature files
└── world-wikis/alaria/bestiary/daemons/    ← Where daemon files would go
```

---

## Quick Navigation by Task

### "I need to understand how file combination works"
1. `CONTENT_COMBINATION_PATTERNS.md` - Overview
2. `file-combination-code-patterns.md` - Code examples
3. `FILE_COMBINATION_QUICK_REFERENCE.txt` - Quick lookup

### "I need to implement daemon combination"
1. `alaria-daemon-implementation-guide.md` - Complete guide
2. `FILE_COMBINATION_QUICK_REFERENCE.txt` - Details
3. Implementation checklist section

### "I need to modify combination code"
1. `file-combination-code-patterns.md` - Current patterns
2. `scripts/lib/file-combiners.ts` - Source code
3. Related test/verification section

### "I need to troubleshoot compilation issues"
1. `alaria-daemon-implementation-guide.md` - Troubleshooting section
2. `CONTENT_COMBINATION_PATTERNS.md` - Troubleshooting checklist
3. `FILE_COMBINATION_QUICK_REFERENCE.txt` - Common issues

### "I need to explain this to someone else"
1. `SUMMARY.md` - High-level overview
2. `CONTENT_COMBINATION_PATTERNS.md` - Visual explanation
3. `FILE_COMBINATION_QUICK_REFERENCE.txt` - Reference

---

## Document Sizes and Read Times

| Document | Size | Read Time | Best For |
|----------|------|-----------|----------|
| FILE_COMBINATION_QUICK_REFERENCE.txt | 4 KB | 5-10 min | Quick lookup |
| CONTENT_COMBINATION_PATTERNS.md | 6 KB | 10-15 min | Understanding design |
| SUMMARY.md | 7 KB | 10-15 min | High-level overview |
| content-combination-pattern.md | 12 KB | 20-30 min | Comprehensive understanding |
| file-combination-code-patterns.md | 16 KB | 20-30 min | Code implementation |
| alaria-daemon-implementation-guide.md | 11 KB | 15-20 min | Step-by-step implementation |

**Total investigation:** ~56 KB, 90-150 minutes to read completely

---

## Key Takeaways

1. **The Pattern:** Individual files → Combination function → Super-document → Processing pipeline

2. **Why It Works:** Separates concerns (organization, processing, output) and scales to 700+ files

3. **Three Variants:**
   - Simple (races): Linear combination
   - Multi-section (talents): Subsections with headers
   - Recursive (world wiki): Nested directory handling

4. **For Daemons:** Add "daemons" to `WORLD_WIKI_COMBINABLE_DIRS` (one line)

5. **Already Proven:** System combines 300+ Heart Rush files + 400+ Alaria files successfully

---

## Investigation Completed

All documentation has been created and organized. The complete pattern is documented with:
- High-level explanations
- Detailed code examples
- Step-by-step implementation guide
- Testing procedures
- Troubleshooting guidance

You now have everything needed to understand, extend, or apply this pattern to new content areas.

---

**Last Updated:** November 24, 2025
**Investigation Status:** Complete
**Documentation Status:** Ready for reference
