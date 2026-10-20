// The fixed task links on the home page and the player home, as the design names them. getHomeFn checks every path
// against manifest.routes, so a renamed chapter fails the home page loudly instead of shipping a dead link.
export type TaskColumn = { title: string; links: Array<{ label: string; path: string }> }

export const LEARN_THE_GAME: TaskColumn = {
  title: 'Learn the game',
  links: [
    { label: 'Introduction', path: '/player/introduction' },
    { label: 'How to play', path: '/player/how-to-play' },
    { label: 'Building your character', path: '/player/building-your-character' },
  ],
}

export const AT_THE_TABLE: TaskColumn = {
  title: 'At the table',
  links: [
    { label: 'Combat', path: '/player/combat' },
    { label: 'Conditions', path: '/player/conditions' },
    { label: 'Dice mechanics', path: '/player/dice-mechanics-resolution' },
    { label: 'Rests & healing', path: '/player/rests-healing' },
    { label: 'Weapons & armor', path: '/player/weapons-cantrips-armor' },
  ],
}

export const RUN_THE_GAME: TaskColumn = {
  title: 'Run the game',
  links: [
    { label: 'GM guide', path: '/gm' },
    { label: 'Monster creation', path: '/gm/monster-creation' },
    { label: 'Weather & events', path: '/gm/weather-events' },
  ],
}

/** Book homes are routes, not compiled pages, so they are not in manifest.routes. */
export const BOOK_HOMES = ['/player', '/gm', '/worlds']
