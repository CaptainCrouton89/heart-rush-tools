import { Link } from '@tanstack/react-router'
import type { TaskColumn } from './home-links'

/** A text-led column of task links: a serif heading over ruled link rows. */
export function TaskLinks({ column, headingLevel = 2 }: { column: TaskColumn; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <section>
      <Heading className="font-serif text-h4 font-semibold text-foreground">{column.title}</Heading>
      <ul className="mt-3 border-t border-border">
        {column.links.map((l) => (
          <li key={l.path} className="border-b border-border">
            <Link to={l.path} className="group flex min-h-11 items-center justify-between gap-4 py-2 text-control text-foreground">
              <span className="group-hover:text-primary group-hover:underline group-hover:underline-offset-4">{l.label}</span>
              <span aria-hidden="true" className="text-muted-foreground group-hover:text-primary">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
