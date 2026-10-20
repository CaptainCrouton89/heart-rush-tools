export type StratagemObjective = {
  title: string
  cn: number | null
  leader: string | null
  state: 'open' | 'done' | 'gone'
}

export type Stratagem = {
  goal: string
  timePerRoll: string
  setupCn: number
  objectives: StratagemObjective[]
  assets: Array<{ name: string; kind: 'asset' | 'hindrance' }>
  status: 'active' | 'finished' | 'abandoned'
  position: number
}

/** Objective CN is its own CN or the setup CN, modified by every asset and hindrance. */
export function objectiveCn(stratagem: Stratagem, index: number): number {
  if (!Number.isInteger(index) || index < 0 || index >= stratagem.objectives.length) throw new RangeError('Unknown objective')
  return (stratagem.objectives[index]!.cn ?? stratagem.setupCn)
    + stratagem.assets.reduce((total, item) => total + (item.kind === 'asset' ? -3 : 3), 0)
}
