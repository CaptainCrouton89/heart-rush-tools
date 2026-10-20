import type { Character } from '@heartrush/rules-engine/types'
import { raceImageUrl, type PlayCatalogue } from '~/catalogue'

/**
 * Name, kin and pronouns, with the race image at 48 px (ruling 23: the rules-site image, nothing when the race has
 * none or is no longer in the catalogue). The kin line is the title written on the character when it was made.
 */
export function IdentityHeader({ character, catalogue }: { character: Character; catalogue: PlayCatalogue }) {
  const race = catalogue.races.get(character.kin.raceId)
  const image = race ? raceImageUrl(race) : null
  const { name, pronouns } = character.identity
  return (
    <header className="flex items-center gap-3">
      {image && (
        <img src={image} alt="" width={48} height={48} className="size-12 shrink-0 rounded-md border border-border bg-surface-muted object-cover" />
      )}
      <div className="min-w-0">
        <h1 className="truncate font-serif text-h2-sm font-semibold">{name || 'Unnamed character'}</h1>
        <p className="truncate text-ui text-muted-foreground">
          {character.kin.titleSnapshot}
          {pronouns && <> · {pronouns}</>}
        </p>
      </div>
    </header>
  )
}
