// /player and /gm: the book's sidebar, its title and one sentence, task links (player only), then every category
// with its pages as ruled rows.
import type { NavNode } from '@heartrush/content/types'
import { SiteShell } from '~/components/shell/site-shell'
import { AREA_DESCRIPTIONS } from './area-descriptions'
import { AT_THE_TABLE, LEARN_THE_GAME } from './home-links'
import { LandingRows, RowGroup } from './rows'
import { TaskLinks } from './task-column'
import type { BookPageData } from './book-page'

export function BookHome({ nav, groups }: { nav: NavNode; groups: NonNullable<BookPageData['groups']> }) {
  const isPlayer = nav.id === 'player'
  return (
    <SiteShell nav={nav} activePath={nav.path}>
      <h1 className="font-serif text-h1-sm font-semibold text-foreground md:text-h1">{nav.label}</h1>
      <p className="mt-4 font-serif text-body-sm text-foreground md:text-body">{AREA_DESCRIPTIONS[nav.id]}</p>
      {isPlayer && (
        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          <TaskLinks column={LEARN_THE_GAME} />
          <TaskLinks column={AT_THE_TABLE} />
        </div>
      )}
      <div className="mt-12">
        {groups.map((g) => (
          <RowGroup key={g.id} title={g.title} path={g.path}>
            <LandingRows rows={g.rows} />
          </RowGroup>
        ))}
      </div>
    </SiteShell>
  )
}
