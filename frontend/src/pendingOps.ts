import { ref } from 'vue'
import { reorderLocally } from './dragReorder'

// A change the user just made (move, merge) that is shown at once, although JD has not confirmed it yet. The
// operation is laid over every list that arrives until the list shows the change itself (the operation then
// returns null) or the time is up, so a live update that is still the old order does not make the item jump back.
export type PendingOp<T> = (items: T[]) => T[] | null

const pending = new Map<string, { until: number; op: PendingOp<any> }[]>()
// Read by lists that apply pending operations in a computed; changes when an operation is added or ends.
export const pendingTick = ref(0)

// Returns a function that withdraws the operation again (the request failed).
export const addPending = <T>(scope: string, op: PendingOp<T>, ttl = 8000): (() => void) => {
  const entry = { until: Date.now() + ttl, op }
  pending.set(scope, [...(pending.get(scope) ?? []), entry])
  pendingTick.value++
  setTimeout(() => pendingTick.value++, ttl + 50)
  return () => {
    pending.set(scope, (pending.get(scope) ?? []).filter((e) => e !== entry))
    pendingTick.value++
  }
}

export const withPending = <T>(scope: string, items: T[]): T[] => {
  void pendingTick.value
  const ops = pending.get(scope)
  if (!ops?.length) return items
  const now = Date.now()
  const alive: typeof ops = []
  let result = items
  for (const entry of ops) {
    if (entry.until < now) continue
    const next = entry.op(result)
    if (next === null) continue
    alive.push(entry)
    result = next
  }
  pending.set(scope, alive)
  return result
}

export const reorderOp = <T>(getId: (item: T) => number, ids: number[], afterId: number): PendingOp<T> => (items) => {
  const out = reorderLocally(items, getId, ids, afterId)
  return out.every((item, i) => item === items[i]) ? null : out
}
