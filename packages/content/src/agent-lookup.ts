/** How an agent looks up a Heart Rush rule it does not know. Shared by the monster generator and the encounter builder; each includes it once. */
export const RULES_LOOKUP = `# Looking up a rule
The Heart Rush rulebook is online. You may run curl in your bash tool for this and nothing else: no other site, no other command, no asking the human anything through a tool.
- Search: \`curl -sS -f --max-time 20 'https://rules.heartrush.party/md/search?q=grappling'\`. Use 1 to 8 words; matching is by word prefix with no typo tolerance, and no match returns \`results: 0\`. Each result has a \`read:\` URL.
- Read: curl that \`read:\` URL (\`https://rules.heartrush.party/md/<path>\`, optionally \`?section=<anchor>\`). It returns the source Markdown, or an outline of section URLs when the page is long; then curl the one section you need.
- Look a rule up whenever you use a mechanic the guidelines in this prompt do not define: a named condition, spell, talent, kin, or a terrain, movement or falling rule. Search first, then read the page. Do not look up anything you do not need; a creature or fight built entirely from what this prompt defines needs no lookup.
- When something you build rests on a rule you looked up, cite it by page and section (for example "see Conditions, Grappled").
- If a lookup fails or finds nothing, say plainly that you are unsure of that rule. Never fill the gap from D&D or any other RPG.`
