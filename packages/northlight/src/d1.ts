/** The slice of Cloudflare's `D1Database` this package uses (keeps the package free of workers-types). */
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = Record<string, unknown>>(): Promise<T | null>
  run(): Promise<{ meta: { changes: number } }>
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>
}

export interface D1 {
  prepare(sql: string): D1PreparedStatement
}

export const nowIso = () => new Date().toISOString()
