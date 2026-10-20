import type { Connection, ConnectionStore } from '@north-light/sdk'

/** The slice of Cloudflare's `KVNamespace` this package uses (keeps the package free of workers-types). */
export interface KV {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
}

const LOCK_TTL_SECONDS = 60 // KV's minimum expirationTtl
const LOCK_WAIT_MS = 15_000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Northlight ConnectionStore on Workers KV.
 * KV has no atomic compare-and-set, so `lock` is an in-isolate queue plus a KV lease key. That stops
 * overlapping refreshes inside one isolate and almost all across isolates; two isolates racing inside
 * the same few milliseconds could still both refresh (the loser's grant is refused with refresh_token_reused
 * and the person signs in again).
 */
export class KvConnectionStore implements ConnectionStore {
  private readonly queues = new Map<string, Promise<unknown>>()

  constructor(private readonly kv: KV) {}

  private key(userId: string) {
    return `conn:${userId}`
  }

  async load(userId: string): Promise<Connection | null> {
    const raw = await this.kv.get(this.key(userId))
    return raw ? (JSON.parse(raw) as Connection) : null
  }

  async save(connection: Connection): Promise<void> {
    await this.kv.put(this.key(connection.userId), JSON.stringify(connection))
  }

  async remove(userId: string, refreshToken: string): Promise<boolean> {
    const current = await this.load(userId)
    if (current?.refreshToken !== refreshToken) return false
    await this.kv.delete(this.key(userId))
    return true
  }

  async lock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    const prior = this.queues.get(userId) ?? Promise.resolve()
    const run = prior.catch(() => undefined).then(() => this.withLease(userId, fn))
    this.queues.set(userId, run)
    try {
      return await run
    } finally {
      if (this.queues.get(userId) === run) this.queues.delete(userId)
    }
  }

  private async withLease<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    const leaseKey = `lock:${userId}`
    const deadline = Date.now() + LOCK_WAIT_MS
    while (await this.kv.get(leaseKey)) {
      if (Date.now() > deadline) throw new Error(`Timed out waiting for the Northlight connection lock for ${userId}`)
      await sleep(250)
    }
    await this.kv.put(leaseKey, '1', { expirationTtl: LOCK_TTL_SECONDS })
    try {
      return await fn()
    } finally {
      await this.kv.delete(leaseKey)
    }
  }
}
