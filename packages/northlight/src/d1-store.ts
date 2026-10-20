import { AsyncLocalStorage } from 'node:async_hooks'
import { CrouterError, type Connection, type ConnectionStore } from '@north-light/sdk'
import { nowIso, type D1 } from './d1'

export interface D1ConnectionStoreOptions {
  /** How long a lock lease lasts without renewal. Default 30 s. */
  leaseMs?: number
  /** How often the holder renews its lease while `fn` runs. Default 10 s. */
  renewMs?: number
  /** Wait between attempts to take a held lock. Default 250 ms. */
  retryMs?: number
  /** Attempts before `lock` gives up with `lock_timeout`. Default 20. */
  attempts?: number
}

interface ConnectionRow {
  user_id: string
  runtime_url: string
  refresh_token: string
  grant_id: string
  access_token: string
  access_token_expires_at: string
  id_token: string | null
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const toConnection = (row: ConnectionRow): Connection => ({
  userId: row.user_id,
  runtimeUrl: row.runtime_url,
  refreshToken: row.refresh_token,
  grantId: row.grant_id,
  accessToken: row.access_token,
  accessTokenExpiresAt: Date.parse(row.access_token_expires_at),
  ...(row.id_token ? { idToken: row.id_token } : {}),
})

const randomToken = () => crypto.randomUUID()

/**
 * The SDK's `ConnectionStore` on D1. `lock` is a fenced lease on the connection row: taking it is one
 * compare-and-set UPDATE, every `save` made while holding it is fenced on its random `lock_token`, and a
 * holder whose lease expired and was taken by another isolate gets `lock_lost` instead of overwriting the
 * newer refresh token. D1 runs each statement atomically, which is the compare-and-set this relies on.
 */
export class D1ConnectionStore implements ConnectionStore {
  private readonly leaseMs: number
  private readonly renewMs: number
  private readonly retryMs: number
  private readonly attempts: number
  /** The lease the current async flow holds, so `save` can fence on it. */
  private readonly held = new AsyncLocalStorage<{ userId: string; token: string }>()

  constructor(
    private readonly db: D1,
    options: D1ConnectionStoreOptions = {},
  ) {
    this.leaseMs = options.leaseMs ?? 30_000
    this.renewMs = options.renewMs ?? 10_000
    this.retryMs = options.retryMs ?? 250
    this.attempts = options.attempts ?? 20
  }

  async load(userId: string): Promise<Connection | null> {
    const row = await this.db.prepare('SELECT * FROM connection WHERE user_id = ?').bind(userId).first<ConnectionRow>()
    return row ? toConnection(row) : null
  }

  /**
   * Inside `lock`: a write fenced on the lease token (zero rows changed means the lease was lost, so it throws).
   * Outside `lock` (a fresh sign-in): an upsert that also clears any lease, so a refresh still running for the
   * previous token cannot save over the new sign-in. The `user` row must already exist.
   */
  async save(connection: Connection): Promise<void> {
    const values = [
      connection.runtimeUrl,
      connection.refreshToken,
      connection.grantId,
      connection.accessToken,
      new Date(connection.accessTokenExpiresAt).toISOString(),
      connection.idToken ?? null,
      nowIso(),
    ]
    const lease = this.held.getStore()
    if (lease && lease.userId === connection.userId) {
      const { meta } = await this.db
        .prepare(
          `UPDATE connection SET runtime_url = ?, refresh_token = ?, grant_id = ?, access_token = ?,
             access_token_expires_at = ?, id_token = ?, updated_at = ?
           WHERE user_id = ? AND lock_token = ?`,
        )
        .bind(...values, connection.userId, lease.token)
        .run()
      if (meta.changes === 0) throw new CrouterError(`lock_lost: the connection lock for ${connection.userId} expired and was taken by another isolate`)
      return
    }
    await this.db
      .prepare(
        `INSERT INTO connection (runtime_url, refresh_token, grant_id, access_token, access_token_expires_at, id_token, updated_at, user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (user_id) DO UPDATE SET
           runtime_url = excluded.runtime_url, refresh_token = excluded.refresh_token, grant_id = excluded.grant_id,
           access_token = excluded.access_token, access_token_expires_at = excluded.access_token_expires_at,
           id_token = excluded.id_token, updated_at = excluded.updated_at, lock_token = NULL, lock_until = NULL`,
      )
      .bind(...values, connection.userId)
      .run()
  }

  async remove(userId: string, refreshToken: string): Promise<boolean> {
    const { meta } = await this.db
      .prepare('DELETE FROM connection WHERE user_id = ? AND refresh_token = ?')
      .bind(userId, refreshToken)
      .run()
    return meta.changes > 0
  }

  async listStale(before: Date): Promise<Connection[]> {
    // Bounded per call; the daily cron picks up the rest, since a refresh moves a row out of the stale set.
    const { results } = await this.db
      .prepare('SELECT * FROM connection WHERE updated_at < ? ORDER BY updated_at LIMIT 100')
      .bind(before.toISOString())
      .all<ConnectionRow>()
    return results.map(toConnection)
  }

  async lock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    const lease = { userId, token: randomToken() }
    for (let attempt = 0; ; attempt++) {
      const now = nowIso()
      const { meta } = await this.db
        .prepare(
          `UPDATE connection SET lock_token = ?, lock_until = ?
           WHERE user_id = ? AND (lock_until IS NULL OR lock_until < ?)`,
        )
        .bind(lease.token, new Date(Date.now() + this.leaseMs).toISOString(), userId, now)
        .run()
      if (meta.changes > 0) break
      // No row means nothing to protect: the SDK's locked closure finds no connection and returns.
      if (!(await this.db.prepare('SELECT 1 AS one FROM connection WHERE user_id = ?').bind(userId).first())) return fn()
      if (attempt + 1 >= this.attempts) throw new CrouterError(`lock_timeout: could not take the connection lock for ${userId}`)
      await sleep(this.retryMs)
    }

    const renew = setInterval(() => {
      void this.db
        .prepare('UPDATE connection SET lock_until = ? WHERE user_id = ? AND lock_token = ?')
        .bind(new Date(Date.now() + this.leaseMs).toISOString(), userId, lease.token)
        .run()
        .then(({ meta }) => {
          if (meta.changes === 0) clearInterval(renew) // lease lost; the fenced save throws lock_lost
        })
        .catch((error) => console.error('connection lease renewal failed', error)) // a missed renewal surfaces at the fenced save
    }, this.renewMs)
    try {
      return await this.held.run(lease, fn)
    } finally {
      clearInterval(renew)
      await this.db
        .prepare('UPDATE connection SET lock_token = NULL, lock_until = NULL WHERE user_id = ? AND lock_token = ?')
        .bind(userId, lease.token)
        .run()
    }
  }
}
