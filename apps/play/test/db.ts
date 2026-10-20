import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPlatformProxy } from 'wrangler'

export type D1 = D1Database
export const PLAY_MIGRATIONS = fileURLToPath(new URL('../migrations/', import.meta.url))
export const TOOLS_MIGRATIONS = fileURLToPath(new URL('../../tools/migrations/', import.meta.url))

/** Applies every `.sql` file in `dir` in name order, one statement at a time. */
export async function applyMigrations(db: D1, dir: string): Promise<string[]> {
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
  for (const file of files) {
    const sql = readFileSync(join(dir, file), 'utf8').replace(/--.*$/gm, '')
    for (const statement of sql.split(';').map((s) => s.trim()).filter(Boolean)) await db.prepare(statement).run()
  }
  return files
}

/**
 * Play's two local databases from `wrangler.jsonc`: `DB` (play's migrations) and `AUTH_DB` (tools' migrations),
 * in memory. This is the configuration production binds, minus the data.
 */
export async function openPlayDbs() {
  const proxy = await getPlatformProxy<{ DB: D1; AUTH_DB: D1 }>({
    configPath: fileURLToPath(new URL('../wrangler.jsonc', import.meta.url)),
    persist: false,
  })
  await applyMigrations(proxy.env.DB, PLAY_MIGRATIONS)
  await applyMigrations(proxy.env.AUTH_DB, TOOLS_MIGRATIONS)
  return { DB: proxy.env.DB, AUTH_DB: proxy.env.AUTH_DB, dispose: () => proxy.dispose() }
}
