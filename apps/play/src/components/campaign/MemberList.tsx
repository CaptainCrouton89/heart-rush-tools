import type { MemberSummary } from '~/server/campaigns'

/** The campaign's members with their role, the GM first (the server's order). */
export function MemberList({ members }: { members: MemberSummary[] }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="eyebrow border-b border-border pb-2">Members</h2>
      <ul className="flex flex-col">
        {members.map((m) => (
          <li key={m.userId} className="flex min-h-11 items-center justify-between gap-3 border-b border-border last:border-b-0">
            <span className="truncate text-ui">{m.displayName}</span>
            <span className="shrink-0 text-meta text-muted-foreground">{m.role === 'gm' ? 'GM' : 'Player'}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
