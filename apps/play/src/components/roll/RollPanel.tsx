// The roll panel (campaign spec §3.2, plan row RP). Ability and roll type (attack and defense only for Might, Agility and
// Cunning), the advantage/disadvantage stepper starting at the engine's `defaultNet`, the modifier with a profession picker
// that fills full or half rank (rounded down), an aspect picker for a check (a positive invocation: the server spends the
// chosen 1…rank DP and adds it to the roll, in the same request as the roll), and **Roll**. Every roll is made by the server (`rollForCharacterFn`); the
// panel only previews the dice the engine's `rollSpec` says will be rolled.
//
// Phone (< 1024 px, the sheet's own breakpoint): a bottom sheet. Desktop: a popover beside `anchor`, or a dialog when the
// caller has no element to anchor to.
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { rollSpec, type RollType } from '@heartrush/rules-engine/dice'
import { isFrail } from '@heartrush/rules-engine/reducers/combat'
import type { AbilityId, Aspect, Character } from '@heartrush/rules-engine/types'
import { Button } from '@heartrush/ui/components/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@heartrush/ui/components/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@heartrush/ui/components/dropdown-menu'
import { Input } from '@heartrush/ui/components/input'
import { Popover, PopoverAnchor, PopoverContent } from '@heartrush/ui/components/popover'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@heartrush/ui/components/sheet'
import { ToggleGroup, ToggleGroupItem } from '@heartrush/ui/components/toggle-group'
import { getCatalogue } from '~/catalogue'
import type { CharacterDoc } from '~/server/characters'
import { MAX_MODIFIER, MAX_NET, rollForCharacterFn } from '~/server/rolls'
import { ROLL_NO_CONNECTION, RollResultView, type RollOutcome } from './RollResult'

/** What the panel needs of a character: a `CharacterDoc` satisfies it. `state` must be a finished character. */
export type RollCharacter = Pick<CharacterDoc, 'id' | 'name' | 'state'>

export type RollPanelProps = {
  /** A finished character the viewer may roll for (its owner, or its campaign's GM; an objective roll needs its owner). */
  character: RollCharacter
  /** The ability the panel opens on; Might when absent. */
  ability?: AbilityId
  /** The roll type the panel opens on; a check when absent (a condition's escape roll opens on a save or a check). */
  type?: RollType
  /** A stratagem objective roll: a skill check, compared with `cn` and labelled with `label` in the feed. */
  objective?: { stratagemId: string; index: number; label: string; cn: number }
  onClose: () => void
  /** The opener (the tapped ability name). Desktop: the popover opens beside it. Focus returns to it on close; without it, to
   * whatever had focus when the panel opened. */
  anchor?: RefObject<HTMLElement | null>
  /** Each roll, and each completion of its complication. */
  onResult?: (outcome: RollOutcome) => void
}

const ABILITIES: { id: AbilityId; label: string }[] = [
  { id: 'might', label: 'Might' },
  { id: 'agility', label: 'Agility' },
  { id: 'cunning', label: 'Cunning' },
  { id: 'presence', label: 'Presence' },
]
const TYPES: { id: RollType; label: string }[] = [
  { id: 'check', label: 'Check' },
  { id: 'save', label: 'Save' },
  { id: 'attack', label: 'Attack' },
  { id: 'defense', label: 'Defense' },
]
const isStanceType = (t: RollType) => t === 'attack' || t === 'defense'
const abilityLabel = (id: AbilityId) => ABILITIES.find((a) => a.id === id)!.label
const typeLabel = (t: RollType) => TYPES.find((x) => x.id === t)!.label.toLowerCase()

const DESKTOP = '(min-width: 1024px)'

function useDesktop(): boolean {
  const [desktop, setDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia(DESKTOP).matches)
  useEffect(() => {
    const query = window.matchMedia(DESKTOP)
    const onChange = () => setDesktop(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return desktop
}

/** The panel, open while mounted; closing it calls `onClose`. */
export function RollPanel(props: RollPanelProps) {
  const desktop = useDesktop()
  const { character, objective, onClose, anchor } = props
  // The panel's title follows the ability picked inside it.
  const [ability, setAbility] = useState<AbilityId>(props.ability ?? 'might')
  const name = character.name || 'This character'
  const title = objective ? `Roll: ${objective.label}` : `Roll ${abilityLabel(ability)}`
  const description = objective ? `${name} · skill check against CN ${objective.cn}` : name
  const onOpenChange = (open: boolean) => {
    if (!open) onClose()
  }
  // Return focus to the opener when the panel closes (the panel is mounted open, so it has no trigger of its own).
  const opener = useRef<Element | null>(typeof document === 'undefined' ? null : document.activeElement)
  const restoreFocus = (e: Event) => {
    const target = anchor?.current ?? opener.current
    if (target instanceof HTMLElement) {
      e.preventDefault()
      target.focus()
    }
  }
  if (character.state.draft) throw new Error('RollPanel: a character still in the builder cannot roll')
  // A different character or objective is a fresh form.
  const body = <RollForm key={`${character.id}:${objective?.stratagemId ?? ''}:${objective?.index ?? ''}`} {...props} state={character.state} ability={ability} onAbility={setAbility} />

  if (desktop && anchor) {
    return (
      <Popover open onOpenChange={onOpenChange}>
        <PopoverAnchor virtualRef={anchor as RefObject<HTMLElement>} />
        <PopoverContent onCloseAutoFocus={restoreFocus} side="right" align="start" className="flex max-h-[85dvh] w-96 flex-col gap-3 overflow-y-auto" aria-label={title}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col">
              <h2 className="font-sans text-control font-semibold">{title}</h2>
              <p className="text-ui text-muted-foreground">{description}</p>
            </div>
            <Button size="compact-icon" type="button" variant="ghost" className="shrink-0" aria-label="Close" onClick={onClose}>
              ×
            </Button>
          </div>
          {body}
        </PopoverContent>
      </Popover>
    )
  }
  if (desktop) {
    return (
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent onCloseAutoFocus={restoreFocus}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {body}
        </DialogContent>
      </Dialog>
    )
  }
  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent side="bottom" onCloseAutoFocus={restoreFocus}>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 p-4">{body}</div>
      </SheetContent>
    </Sheet>
  )
}

type RollFormProps = Omit<RollPanelProps, 'ability'> & { state: Character; ability: AbilityId; onAbility: (a: AbilityId) => void }

function RollForm({ character: doc, state: character, ability, onAbility: setAbility, type: initialType, objective, onResult }: RollFormProps) {
  const roll = useServerFn(rollForCharacterFn)
  const router = useRouter()
  const ids = useId()

  const [type, setType] = useState<RollType>(initialType ?? 'check')
  const defaultNet = rollSpec(character, { type: 'check', ability }, getCatalogue().conditions).defaultNet
  const [net, setNet] = useState(defaultNet)
  // The stepper restarts at the default whenever the ability changes or a live update changes the character's conditions.
  const startedFor = `${ability}:${defaultNet}`
  const [netFor, setNetFor] = useState(startedFor)
  if (netFor !== startedFor) {
    setNetFor(startedFor)
    setNet(defaultNet)
  }
  const [modifierText, setModifierText] = useState('')
  // The modifier was filled from a Wisdom of Experience profession (`Profession.rerollOnes`): a skill check may reroll its
  // kept 1s. Typing or stepping the modifier by hand clears it.
  const [wisdomPick, setWisdomPick] = useState(false)
  // The aspect invoked on this roll and the DP spent on it (1…its rank; checks only). Frail may only be invoked against the character.
  const [pick, setPick] = useState<{ aspectId: string; dp: number } | null>(null)
  const invocable = character.aspects.filter((a) => !isFrail(a))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<RollOutcome | null>(null)

  const rollType: RollType = objective ? 'check' : type
  const spec = rollSpec(character, { type: rollType, ability }, getCatalogue().conditions)
  const modifier = /^[-−]?\d+$/.test(modifierText) ? Number(modifierText.replace('−', '-')) : 0
  const modifierInvalid = modifierText !== '' && modifierText !== '-' && modifierText !== '−' && !/^[-−]?\d+$/.test(modifierText)
  const aspect: Aspect | null = rollType === 'check' && pick ? (invocable.find((a) => a.id === pick.aspectId) ?? null) : null
  const spend = aspect && pick ? Math.min(pick.dp, aspect.rank) : 0
  const aspectShort = aspect !== null && character.play.dp < spend

  const pickAbility = (next: AbilityId) => {
    setAbility(next)
    // Presence has no stance, so no attack or defense.
    if (next === 'presence' && isStanceType(type)) setType('check')
  }
  const setModifier = (n: number, wisdom = false) => {
    setModifierText(n === 0 ? '' : String(Math.max(-MAX_MODIFIER, Math.min(MAX_MODIFIER, n))))
    setWisdomPick(wisdom)
  }

  const show = (next: RollOutcome) => {
    setOutcome(next)
    onResult?.(next)
  }
  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await roll({
        data: {
          characterId: doc.id,
          type: rollType,
          ability,
          modifier,
          net,
          ...(aspect ? { aspect: { aspectId: aspect.id, dp: spend } } : {}),
          ...(objective ? { objective: { stratagemId: objective.stratagemId, index: objective.index } } : {}),
        },
      })
      if (!r.ok) return setError(r.message)
      if (r.character) {
        // The roll spent DP: the aspect is used up for this roll, and the page's loader adopts the new revision.
        setPick(null)
        void router.invalidate()
      }
      show({
        characterId: doc.id,
        rollId: r.roll?.id ?? null,
        view: r.result,
        ...(rollType === 'check' && wisdomPick ? { wisdom: true } : {}),
        // The CN the server rolled against (it may have changed since the panel opened); in no campaign there is no objective.
        ...(objective ? { objective: { label: objective.label, cn: r.roll?.objective?.cn ?? objective.cn } } : {}),
      })
    } catch {
      setError(ROLL_NO_CONNECTION)
    } finally {
      setBusy(false)
    }
  }

  const preview = [
    ...spec.dice.reduce<{ name: string; count: number }[]>((acc, d) => {
      const name = `${d.role === 'heart' ? 'heart ' : ''}d${d.sides}`
      const last = acc[acc.length - 1]
      if (last && last.name === name && d.role === 'weapon') last.count++
      else acc.push({ name, count: 1 })
      return acc
    }, []).map((p) => (p.count > 1 ? `${p.count}${p.name}` : p.name)),
    ...(spec.flat ? [String(spec.flat)] : []),
  ].join(' + ')

  return (
    <div className="flex flex-col gap-4">
      <Field label="Ability">
        <ToggleGroup type="single" value={ability} onValueChange={(v) => v && pickAbility(v as AbilityId)} className="w-full" aria-label="Ability">
          {ABILITIES.map((a) => (
            <ToggleGroupItem key={a.id} value={a.id}>
              {a.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>

      {!objective && (
        <Field label="Roll">
          <ToggleGroup type="single" value={type} onValueChange={(v) => v && setType(v as RollType)} className="w-full" aria-label="Roll type">
            {TYPES.map((t) => (
              <ToggleGroupItem key={t.id} value={t.id} disabled={ability === 'presence' && isStanceType(t.id)}>
                {t.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
      )}

      <p className="text-ui">
        <span className="text-muted-foreground">Dice</span> <span className="dice">{preview}</span>
      </p>

      <Field label="Advantage / disadvantage">
        <div className="flex items-center gap-2">
          <Button size="compact-icon" type="button" variant="line" aria-label="One more disadvantage" disabled={net <= -MAX_NET} onClick={() => setNet(net - 1)}>
            −
          </Button>
          <output className="min-w-16 text-center font-semibold tabular-nums" aria-live="polite">
            {net > 0 ? `A${net}` : net < 0 ? `D${-net}` : 'None'}
          </output>
          <Button size="compact-icon" type="button" variant="line" aria-label="One more advantage" disabled={net >= MAX_NET} onClick={() => setNet(net + 1)}>
            +
          </Button>
          {defaultNet !== 0 && (
            <span className="text-meta text-muted-foreground">
              conditions: D{-defaultNet}
            </span>
          )}
        </div>
      </Field>

      <Field label="Modifier" htmlFor={`${ids}-mod`}>
        <div className="flex items-center gap-2">
          <Button size="compact-icon" type="button" variant="line" aria-label="Modifier one less" onClick={() => setModifier(modifier - 1)}>
            −
          </Button>
          <Input
            id={`${ids}-mod`}
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            value={modifierText}
            aria-invalid={modifierInvalid || undefined}
            onChange={(e) => {
              setModifierText(e.target.value.replace(/[^\d\-−]/g, '').slice(0, 5))
              setWisdomPick(false)
            }}
            className="h-11 w-16 shrink-0 px-2 text-center font-semibold tabular-nums md:text-control"
          />
          <Button size="compact-icon" type="button" variant="line" aria-label="Modifier one more" onClick={() => setModifier(modifier + 1)}>
            +
          </Button>
          {character.professions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="compact" type="button" variant="line" className="min-w-0 flex-1 px-3">
                  Profession ▾
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
                {character.professions.map((p) => (
                  <div key={p.id}>
                    <DropdownMenuLabel className="text-meta text-muted-foreground">
                      {p.name} · rank {p.rank}{p.rerollOnes ? ' · checks reroll 1s' : ''}
                    </DropdownMenuLabel>
                    <DropdownMenuItem className="min-h-11" onSelect={() => setModifier(p.rank, p.rerollOnes)}>
                      Full rank +{p.rank}
                    </DropdownMenuItem>
                    <DropdownMenuItem className="min-h-11" onSelect={() => setModifier(Math.floor(p.rank / 2), p.rerollOnes)}>
                      Half rank +{Math.floor(p.rank / 2)}
                    </DropdownMenuItem>
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </Field>

      {rollType === 'check' && invocable.length > 0 && (
        <Field label="Aspect">
          {aspect ? (
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 text-ui">
                <span className="font-semibold">“{aspect.text}”</span> +{spend} · −{spend} DP
                <span className="block text-meta text-muted-foreground">{aspectShort ? `not enough DP (${character.play.dp})` : `${character.play.dp} DP now; spent when you roll`}</span>
              </p>
              <Button size="compact" type="button" variant="ghost" className="shrink-0" aria-label={`Don't invoke "${aspect.text}"`} onClick={() => setPick(null)}>
                Remove
              </Button>
            </div>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="compact" type="button" variant="line" className="self-start px-3">
                  Invoke an aspect ▾
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
                <DropdownMenuLabel className="text-meta text-muted-foreground">Spend up to the aspect's rank in DP · {character.play.dp} DP</DropdownMenuLabel>
                {invocable.flatMap((a) =>
                  Array.from({ length: a.rank }, (_, i) => a.rank - i).map((n) => (
                    <DropdownMenuItem key={`${a.id}:${n}`} className="min-h-11" disabled={character.play.dp < n} onSelect={() => setPick({ aspectId: a.id, dp: n })}>
                      {a.text} +{n} · −{n} DP{character.play.dp < n ? ' · not enough DP' : ''}
                    </DropdownMenuItem>
                  )),
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </Field>
      )}

      <Button size="compact" variant="line-primary" type="button" disabled={busy || modifierInvalid || aspectShort} onClick={() => void submit()}>
        {busy ? 'Rolling…' : `Roll ${abilityLabel(ability)} ${typeLabel(rollType)}`}
      </Button>

      {error && (
        <p role="alert" className="text-ui text-primary">
          {error}
        </p>
      )}
      {outcome && (
        <div className="border-t border-border pt-3">
          <RollResultView outcome={outcome} character={character} onChange={show} />
        </div>
      )}
    </div>
  )
}

/** A labelled control: `htmlFor` labels one input; without it the block is a group named by the label. */
function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  const id = useId()
  return htmlFor ? (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="eyebrow text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  ) : (
    <div role="group" aria-labelledby={id} className="flex flex-col gap-1.5">
      <span id={id} className="eyebrow text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  )
}
