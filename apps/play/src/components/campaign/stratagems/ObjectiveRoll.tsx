import { useRef, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { Button } from '@heartrush/ui/components/button'
import { RollPanel, type RollCharacter } from '~/components/roll/RollPanel'
import { ROLL_NO_CONNECTION } from '~/components/roll/RollResult'
import { getCharacterFn } from '~/server/characters'

export type ObjectiveRollProps = {
  /** The leader: the viewer's own character. */
  characterId: string
  stratagemId: string
  index: number
  /** "Take Thornwall — Cut the supply road" */
  label: string
  /** The objective's current CN as listed; the server rolls against the CN it computes at roll time. */
  cn: number
}

/**
 * **Roll** on an open objective the viewer's character leads (spec §2.3). It reads the character's sheet (the panel's dice
 * and default disadvantage come from it) and opens the roll panel as a skill check with the ability picker, compared with
 * the objective's CN. The server checks that the roller owns the leader and that the objective is still open; the roll
 * lands in the campaign's feed. Nothing here changes the objective.
 */
export function ObjectiveRoll({ characterId, stratagemId, index, label, cn }: ObjectiveRollProps) {
  const read = useServerFn(getCharacterFn)
  const anchor = useRef<HTMLButtonElement | null>(null)
  const [character, setCharacter] = useState<RollCharacter | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const open = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await read({ data: { characterId } })
      if (!r.ok) return setError(`Couldn't open the roll: ${r.message.replace(/\.$/, '')}.`)
      if (r.character.state.draft) return setError("Couldn't open the roll: the character is still in the builder.")
      setCharacter(r.character)
    } catch {
      setError(ROLL_NO_CONNECTION)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button ref={anchor} type="button" size="lg" aria-haspopup="dialog" disabled={busy} onClick={() => void open()}>
        {busy ? 'Opening…' : 'Roll'}
      </Button>
      {error && (
        <p role="alert" className="basis-full text-ui text-primary">
          {error}
        </p>
      )}
      {character && (
        <RollPanel character={character} objective={{ stratagemId, index, label, cn }} anchor={anchor} onClose={() => setCharacter(null)} />
      )}
    </>
  )
}
