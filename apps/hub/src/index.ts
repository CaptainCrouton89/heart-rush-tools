// heartrush.party: `/` is a links page to the Heart Rush sites; `/health` answers 200; the two font files the page
// uses are served under /_hub/fonts/; every other path is a 301 to the same path and query on rules.heartrush.party.
import uiStyles from '@heartrush/ui/styles.css'
import { appearanceScript } from '@heartrush/ui/appearance'
import plexSans from '@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2'
import sourceSerif from '@fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-normal.woff2'

const FONTS: Record<string, ArrayBuffer> = {
  '/_hub/fonts/ibm-plex-sans-latin-wght-normal.woff2': plexSans,
  '/_hub/fonts/source-serif-4-latin-wght-normal.woff2': sourceSerif,
}

// The first sentence of the rulebook's introduction (heart_rush/all_sections_formatted/Intro.md).
const DESCRIPTION =
  'Heart Rush is a crunchy fantasy TTRPG that does one thing exceptionally well: dangerous, tactical combat that actually moves fast.'

const LINKS = [
  { title: 'Rules', href: 'https://rules.heartrush.party/', line: 'The rulebook, GM guide and Alaria wiki' },
  { title: 'Tools', href: 'https://tools.heartrush.party/', line: 'GM tools' },
  { title: 'Play', href: 'https://play.heartrush.party/', line: 'Character sheets and campaigns' },
  { title: 'World map', href: 'https://world.alariawiki.online/', line: 'The map of Alaria' },
]

/** The body of a top-level `<selector> { … }` block in the ui stylesheet. Throws if the stylesheet lost it. */
function block(selector: string): string {
  const start = uiStyles.indexOf(`\n${selector} {\n`)
  if (start === -1) throw new Error(`@heartrush/ui styles.css has no top-level "${selector}" block`)
  const open = start + selector.length + 4
  const end = uiStyles.indexOf('\n}', open)
  return uiStyles.slice(open, end)
}

// Token values come straight from @heartrush/ui: the light and dark palettes, plus the fonts, radii and type scale
// that its `@theme` block declares, here as plain custom properties (the page has no Tailwind build).
const TOKENS = `:root {${block(':root')}${block('@theme')}}\n.dark {${block('.dark')}}`

const CSS = `${TOKENS}
@font-face { font-family: 'Source Serif 4 Variable'; font-style: normal; font-display: swap; font-weight: 200 900;
  src: url(/_hub/fonts/source-serif-4-latin-wght-normal.woff2) format('woff2-variations'); }
@font-face { font-family: 'IBM Plex Sans Variable'; font-style: normal; font-display: swap; font-weight: 100 700;
  src: url(/_hub/fonts/ibm-plex-sans-latin-wght-normal.woff2) format('woff2-variations'); }
*, ::before, ::after { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
body { background: var(--background); color: var(--foreground); font-family: var(--font-sans);
  font-size: var(--text-ui); line-height: var(--text-ui--line-height); -webkit-font-smoothing: antialiased; }
:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
::selection { background: var(--accent); color: var(--accent-foreground); }
main { max-width: 640px; margin: 0 auto; padding: 56px 20px 64px; }
h1 a { display: inline-flex; align-items: center; gap: 12px; color: inherit; text-decoration: none; }
h1 { font-family: var(--font-serif); font-weight: 600;
  font-size: var(--text-h1-sm); line-height: var(--text-h1-sm--line-height); letter-spacing: 0.06em; text-transform: uppercase; }
h1 svg { width: 16px; height: 16px; flex-shrink: 0; color: var(--primary); }
.description { margin-top: 20px; font-family: var(--font-serif); font-size: var(--text-body-sm); line-height: var(--text-body-sm--line-height); }
ul { list-style: none; margin-top: 40px; border-top: 1px solid var(--border); }
li { border-bottom: 1px solid var(--border); }
li a { display: grid; grid-template-columns: 1fr auto; align-items: baseline; column-gap: 16px; row-gap: 4px;
  padding: 16px 0; color: inherit; text-decoration: none; }
.title { font-family: var(--font-serif); font-size: var(--text-h4); line-height: var(--text-h4--line-height); font-weight: 600; }
.line { color: var(--muted-foreground); }
.arrow { grid-row: span 2; align-self: center; font-size: var(--text-control); color: var(--muted-foreground); }
li a:hover .title, li a:focus-visible .title { color: var(--primary); text-decoration: underline; text-underline-offset: 4px; }
li a:hover .arrow, li a:focus-visible .arrow { color: var(--primary); }
@media (min-width: 768px) {
  main { padding-top: 120px; }
  h1 { font-size: var(--text-h1); line-height: var(--text-h1--line-height); }
  h1 svg { width: 20px; height: 20px; }
  .description { font-size: var(--text-body); line-height: var(--text-body--line-height); }
}
@media (prefers-reduced-motion: reduce) { * { transition-duration: 0.01ms !important; } }`

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Heart Rush</title>
<meta name="description" content="${DESCRIPTION}">
<script>${appearanceScript}</script>
<link rel="preload" href="/_hub/fonts/source-serif-4-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/_hub/fonts/ibm-plex-sans-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<style>${CSS}</style>
</head>
<body>
<main>
<h1><a href="/"><svg viewBox="0 0 10 10" aria-hidden="true" focusable="false"><path d="M5 0 10 5 5 10 0 5Z" fill="currentColor"/></svg><span>Heart Rush</span></a></h1>
<p class="description">${DESCRIPTION}</p>
<ul>
${LINKS.map(
  (l) =>
    `<li><a href="${l.href}"><span class="title">${l.title}</span><span class="arrow" aria-hidden="true">→</span><span class="line">${l.line}</span></a></li>`,
).join('\n')}
</ul>
</main>
</body>
</html>
`

export default {
  fetch(request: Request): Response {
    const source = new URL(request.url)
    const readable = request.method === 'GET' || request.method === 'HEAD'

    if (readable && source.pathname === '/') {
      return new Response(PAGE, {
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' },
      })
    }
    if (readable && source.pathname === '/health') return Response.json({ ok: true, app: 'hub' })
    const font = readable ? FONTS[source.pathname] : undefined
    if (font) {
      return new Response(font, {
        headers: { 'content-type': 'font/woff2', 'cache-control': 'public, max-age=31536000, immutable' },
      })
    }

    const target = new URL('https://rules.heartrush.party')
    target.pathname = source.pathname
    target.search = source.search
    return Response.redirect(target, 301)
  },
}
