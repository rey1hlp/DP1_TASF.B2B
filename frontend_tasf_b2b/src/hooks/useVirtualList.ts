import { useMemo, useState } from 'react'

export type UseVirtualListOptions = {
  itemHeight: number
  listHeight: number
  overscan?: number
}

export default function useVirtualList<T>(
  items: T[],
  { itemHeight, listHeight, overscan = 6 }: UseVirtualListOptions
) {
  const [scrollTop, setScrollTop] = useState(0)

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight))
  const visibleCount = Math.ceil(listHeight / itemHeight) + overscan
  const endIndex = Math.min(items.length, startIndex + visibleCount)

  const visibleItems = useMemo(
    () => items.slice(startIndex, endIndex),
    [endIndex, items, startIndex]
  )

  return {
    listHeight,
    offsetY: startIndex * itemHeight,
    scrollTop,
    setScrollTop,
    totalHeight: items.length * itemHeight,
    visibleItems,
  }
}
