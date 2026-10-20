import { useMatch } from '@tanstack/react-router'

/**
 * "Edit" in a sheet section's heading: a link to that block of `/characters/$id/edit`. The character's id comes
 * from the sheet route's `$id` param, because a sheet section receives the character state, which carries no id.
 * On any other page that reuses the sheet sections (where `$id` may name something else) there is no link.
 */
export function EditLink({ block, label = 'Edit' }: { block: 'identity' | 'gear' | 'professions' | 'notes'; label?: string }) {
  const id = useMatch({ from: '/characters/$id', shouldThrow: false })?.params.id
  if (!id) return null
  return (
    <a href={`/characters/${encodeURIComponent(id)}/edit#${block}`} className="inline-flex min-h-11 items-center text-ui text-primary underline underline-offset-4">
      {label}
    </a>
  )
}
