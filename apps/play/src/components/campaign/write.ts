// One campaign write from the page and the line it shows when it does not go through. Refusals arrive as values
// (`{ok: false, message}`); a request that never reached the server rejects with a TypeError.

export type WriteResult<R> = { ok: true; value: R } | { ok: false; text: string }

/** `doing` starts the failure line: "Couldn't create the campaign: …". */
export async function campaignWrite<T extends { ok: true } | { ok: false; message: string }>(
  doing: string,
  write: () => Promise<T>,
): Promise<WriteResult<Extract<T, { ok: true }>>> {
  try {
    const result = await write()
    if (!result.ok) return { ok: false, text: `Couldn't ${doing}: ${result.message.replace(/\.$/, '')}.` }
    return { ok: true, value: result as Extract<T, { ok: true }> }
  } catch (e) {
    console.error(`campaign write failed (${doing})`, e)
    return { ok: false, text: e instanceof TypeError ? `Couldn't ${doing}: no connection.` : `Couldn't ${doing}: something went wrong. Try again.` }
  }
}
