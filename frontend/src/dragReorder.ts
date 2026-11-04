import { ref } from 'vue'

export type DropPosition = 'before' | 'after'

// Share of an item's height at its top and bottom that reorders; the part in between merges (packages).
export const EDGE_ZONE = 0.15
export const inMergeZone = (event: DragEvent) => {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  return event.clientY > rect.top + rect.height * EDGE_ZONE && event.clientY < rect.bottom - rect.height * EDGE_ZONE
}

// Drag & drop reordering for a list of items identified by numeric ids.
// onMove receives the ids to move (in list order) and the id they should be placed after (-1 = top).
// getGroup returns the ids that travel along with the dragged one (the marked items when it is marked).
export const useDragReorder = (
  getIds: () => number[],
  onMove: (ids: number[], afterId: number) => void,
  getGroup?: (id: number) => number[],
  // Optional merge: dropping in the middle of an item (outside the edge zones) calls this instead of reordering.
  onMerge?: (ids: number[], targetId: number) => void
) => {
  const dragId = ref<number | null>(null)
  const overId = ref<number | null>(null)
  const position = ref<DropPosition>('before')
  const mergeId = ref<number | null>(null)
  const groupOf = (moving: number) => {
    const group = getGroup?.(moving) ?? [moving]
    return new Set(group.includes(moving) ? group : [moving])
  }

  const onDragStart = (id: number, event: DragEvent) => {
    dragId.value = id
    event.dataTransfer?.setData('text/plain', String(id))
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
  }

  const onDragOver = (id: number, event: DragEvent) => {
    if (dragId.value === null) return
    event.preventDefault()
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    if (onMerge && inMergeZone(event) && !groupOf(dragId.value).has(id)) {
      mergeId.value = id
      overId.value = null
      return
    }
    mergeId.value = null
    overId.value = id
    position.value = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    const moving = dragId.value
    const target = overId.value
    const set = moving === null ? new Set<number>() : groupOf(moving)
    if (moving !== null && mergeId.value !== null) {
      onMerge?.(getIds().filter((id) => set.has(id)), mergeId.value)
    } else if (moving !== null && target !== null && !set.has(target)) {
      const all = getIds()
      const rest = all.filter((id) => !set.has(id))
      const targetIndex = rest.indexOf(target)
      const insertAt = position.value === 'before' ? targetIndex : targetIndex + 1
      const after = insertAt === 0 ? -1 : rest[insertAt - 1]
      onMove(all.filter((id) => set.has(id)), after)
    }
    onDragEnd()
  }

  const onDragEnd = () => {
    dragId.value = null
    overId.value = null
    mergeId.value = null
  }

  const dropClass = (id: number) =>
    overId.value === id && dragId.value !== id ? (position.value === 'before' ? 'drop-before' : 'drop-after') : ''

  return { dragId, overId, mergeId, onDragStart, onDragOver, onDrop, onDragEnd, dropClass }
}

// Local (optimistic) reorder, the next live update from the server replaces it with the real order.
export const reorderLocally = <T>(items: T[], getId: (item: T) => number, ids: number[], afterId: number): T[] => {
  const set = new Set(ids)
  const moving = items.filter((item) => set.has(getId(item)))
  if (!moving.length) return items
  const rest = items.filter((item) => !set.has(getId(item)))
  const at = afterId === -1 ? 0 : rest.findIndex((item) => getId(item) === afterId) + 1
  rest.splice(at, 0, ...moving)
  return rest
}
