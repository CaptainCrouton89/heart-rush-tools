// Magic.md: the nine elements, as the engine spells them (lower case). The engine refuses any other element
// (`bad_action`); this list only fills the pickers.
export const ELEMENTS = ['fire', 'water', 'air', 'earth', 'light', 'dark', 'force', 'time', 'void'] as const

export const elementLabel = (element: string): string => element.charAt(0).toUpperCase() + element.slice(1)
