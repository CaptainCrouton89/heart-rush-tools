import { useMemo, useState, type FormEvent } from 'react'
import type { PlayCondition } from '@heartrush/rules-engine/catalogue'
import type { AbilityId, Character } from '@heartrush/rules-engine/types'
import { Button } from '@heartrush/ui/components/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@heartrush/ui/components/dialog'
import { Input } from '@heartrush/ui/components/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@heartrush/ui/components/tabs'
import type { ActionDraft } from '../use-character'

const ABILITIES: { id: AbilityId; label: string }[] = [
  { id: 'might', label: 'Might' },
  { id: 'agility', label: 'Agility' },
  { id: 'cunning', label: 'Cunning' },
  { id: 'presence', label: 'Presence' },
]

/** The tags a condition carries in `Conditions.md`. */
export function conditionTags(c: Pick<PlayCondition, 'leveled' | 'fading' | 'ongoing'>): string {
  return [c.leveled && 'leveled', c.fading && 'fading', c.ongoing && 'ongoing'].filter(Boolean).join(' · ')
}

/**
 * The [+] picker: a searchable list of the rulebook's conditions, and a form for a custom condition (name, the
 * abilities it gives disadvantage on, starting level, permanent). Picking a leveled condition the character already
 * has adds one manual level; an unleveled one already present is not offered.
 */
export function AddConditionDialog({
  open, onOpenChange, character, conditions, dispatch,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  character: Character
  conditions: ReadonlyMap<string, PlayCondition>
  dispatch: (action: ActionDraft) => unknown
}) {
  const [query, setQuery] = useState('')
  const [name, setName] = useState('')
  const [affects, setAffects] = useState<AbilityId[]>([])
  const [level, setLevel] = useState(1)
  const [permanent, setPermanent] = useState(false)

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...conditions.values()].filter((c) => !q || c.title.toLowerCase().includes(q))
  }, [conditions, query])

  const close = () => {
    onOpenChange(false)
    setQuery('')
    setName('')
    setAffects([])
    setLevel(1)
    setPermanent(false)
  }

  const pick = (c: PlayCondition) => {
    const manual = character.conditions.find((k) => k.conditionId === c.id && k.source === 'manual')
    const level = c.leveled ? Math.min(5, (manual?.level ?? 0) + 1) : null
    void dispatch({ kind: 'condition:set', conditionId: c.id, level, ...(manual ? {} : { permanent: false }) })
    close()
  }

  const addCustom = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    void dispatch({ kind: 'condition:custom', custom: { name: name.trim(), affects }, level, permanent })
    close()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="flex max-h-[85dvh] flex-col gap-3">
        <DialogHeader>
          <DialogTitle>Add a condition</DialogTitle>
          <DialogDescription className="sr-only">Pick a condition from the rulebook or describe a custom one.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="rulebook" className="flex min-h-0 flex-col gap-3">
          <TabsList aria-label="Condition source">
            <TabsTrigger value="rulebook" className="flex-1">
              Rulebook
            </TabsTrigger>
            <TabsTrigger value="custom" className="flex-1">
              Custom
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rulebook" className="flex min-h-0 flex-col gap-2">
            <Input aria-label="Search conditions" placeholder="Search conditions" value={query} onChange={(e) => setQuery(e.target.value)} className="h-11" />
            <ul className="-mx-1 min-h-0 overflow-y-auto">
              {list.map((c) => {
                const present = character.conditions.some((k) => k.conditionId === c.id)
                const full = c.leveled
                  ? character.conditions.reduce((n, k) => n + (k.conditionId === c.id ? (k.level ?? 1) : 0), 0) >= 5
                  : present
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      disabled={full}
                      onClick={() => pick(c)}
                      className="flex min-h-11 w-full flex-col items-start rounded-sm px-2 py-2 text-left hover:bg-surface-muted disabled:opacity-50"
                    >
                      <span className="text-ui font-medium">
                        {c.title}
                        {present && c.leveled && !full && <span className="ml-2 text-meta text-muted-foreground">+1 level</span>}
                        {full && <span className="ml-2 text-meta text-muted-foreground">{c.leveled ? 'at level 5' : 'already on'}</span>}
                      </span>
                      <span className="text-meta text-muted-foreground">{conditionTags(c)}</span>
                      <span className="line-clamp-2 text-meta text-muted-foreground">{c.body}</span>
                    </button>
                  </li>
                )
              })}
              {list.length === 0 && <li className="px-2 py-2 text-ui text-muted-foreground">No condition matches.</li>}
            </ul>
          </TabsContent>

          <TabsContent value="custom">
            <form onSubmit={addCustom} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-ui">
                Name
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cursed" className="h-11" />
              </label>
              <fieldset className="flex flex-col gap-1">
                <legend className="text-ui">Disadvantage per level on</legend>
                <div className="flex flex-wrap gap-2">
                  {ABILITIES.map((a) => {
                    const on = affects.includes(a.id)
                    return (
                      <Button size="compact"
                        key={a.id}
                        type="button"
                        variant={on ? 'secondary' : 'line'}
                        aria-pressed={on}
                        className={`px-3 ${on ? 'bg-accent text-accent-foreground' : ''}`}
                        onClick={() => setAffects((list) => (on ? list.filter((x) => x !== a.id) : [...list, a.id]))}
                      >
                        {a.label}
                      </Button>
                    )
                  })}
                </div>
              </fieldset>
              <div className="flex items-center gap-2 text-ui">
                Level
                <Button size="compact-icon" type="button" variant="line" aria-label="Level one less" disabled={level <= 1} onClick={() => setLevel(level - 1)}>
                  −
                </Button>
                <span className="w-6 text-center font-semibold tabular-nums">{level}</span>
                <Button size="compact-icon" type="button" variant="line" aria-label="Level one more" disabled={level >= 5} onClick={() => setLevel(level + 1)}>
                  +
                </Button>
              </div>
              <label className="flex min-h-11 items-center gap-3 text-ui">
                <input type="checkbox" className="size-5 accent-primary" checked={permanent} onChange={(e) => setPermanent(e.target.checked)} />
                Permanent
              </label>
              <Button size="compact" variant="line-primary" type="submit" disabled={!name.trim()}>
                Add {name.trim() || 'condition'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
