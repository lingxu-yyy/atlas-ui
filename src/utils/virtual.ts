/**
 * 虚拟滚动的纯函数层：不接触 DOM，只做区间数学。
 * 固定行高是前提，因此可见区间可以直接由 scrollTop / itemHeight 推出。
 */

export interface VisibleRangeInput {
  scrollTop: number
  viewportHeight: number
  itemHeight: number
  total: number
  /** 上下各多渲染几行，默认 4 */
  overscan?: number
}

export interface VisibleRange {
  /** 含 */
  start: number
  /** 不含 */
  end: number
  /** 渲染容器的 translateY */
  offsetY: number
  totalHeight: number
}

const DEFAULT_OVERSCAN = 4

/** 把下标钳制到 [0, total]，end 是开区间，允许等于 total */
export function clampIndex(index: number, total: number): number {
  if (!Number.isFinite(index)) return 0
  const max = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0
  return Math.min(Math.max(0, Math.floor(index)), max)
}

export function getVisibleRange(input: VisibleRangeInput): VisibleRange {
  const { scrollTop, viewportHeight, itemHeight, total } = input
  const overscan = Math.max(0, input.overscan ?? DEFAULT_OVERSCAN)

  // total / itemHeight 非法时返回空区间，避免除零与 NaN 扩散到样式
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(itemHeight) || itemHeight <= 0) {
    const safeTotal = Number.isFinite(total) && total > 0 ? total : 0
    const safeItemHeight = Number.isFinite(itemHeight) && itemHeight > 0 ? itemHeight : 0
    return { start: 0, end: 0, offsetY: 0, totalHeight: safeTotal * safeItemHeight }
  }

  const totalHeight = total * itemHeight
  const safeViewport = Number.isFinite(viewportHeight) ? Math.max(0, viewportHeight) : 0
  const maxScroll = Math.max(0, totalHeight - safeViewport)
  const safeScroll = Number.isFinite(scrollTop)
    ? Math.min(Math.max(0, scrollTop), maxScroll)
    : 0

  const firstVisible = Math.floor(safeScroll / itemHeight)
  const visibleCount = Math.ceil(safeViewport / itemHeight)

  // +1 覆盖底部被截断的那一行，两侧再各加 overscan
  const start = clampIndex(firstVisible - overscan, total)
  const end = clampIndex(firstVisible + visibleCount + 1 + overscan, total)

  return {
    start,
    end,
    offsetY: start * itemHeight,
    totalHeight,
  }
}

/** 让目标项居中；空间不足时贴顶，返回值始终 >= 0 */
export function scrollTopForIndex(
  index: number,
  itemHeight: number,
  viewportHeight: number,
): number {
  if (!Number.isFinite(index) || !Number.isFinite(itemHeight) || itemHeight <= 0) return 0
  if (!Number.isFinite(viewportHeight)) return 0
  const viewport = Math.max(0, viewportHeight)
  const centered = index * itemHeight - (viewport - itemHeight) / 2
  return Math.max(0, centered)
}
