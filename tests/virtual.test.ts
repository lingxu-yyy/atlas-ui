import { describe, expect, it } from 'vitest'

import { clampIndex, getVisibleRange, scrollTopForIndex } from '../src/utils/virtual'

describe('getVisibleRange', () => {
  it('total=0 时 start=end=0、totalHeight=0', () => {
    expect(
      getVisibleRange({ scrollTop: 100, viewportHeight: 320, itemHeight: 32, total: 0 }),
    ).toEqual({ start: 0, end: 0, offsetY: 0, totalHeight: 0 })
  })

  it('按固定行高计算可见区间并带上 overscan', () => {
    const range = getVisibleRange({
      scrollTop: 3200,
      viewportHeight: 256,
      itemHeight: 32,
      total: 1000,
      overscan: 4,
    })

    expect(range.start).toBe(96)
    expect(range.end).toBe(113)
    expect(range.offsetY).toBe(96 * 32)
    expect(range.totalHeight).toBe(32000)
  })

  it('scrollTop 超出最大滚动距离时钳制到末尾', () => {
    const range = getVisibleRange({
      scrollTop: 999999,
      viewportHeight: 256,
      itemHeight: 32,
      total: 100,
    })

    expect(range.start).toBe(88)
    expect(range.end).toBe(100)
    expect(range.offsetY).toBe(88 * 32)
    expect(range.totalHeight).toBe(3200)
  })

  it('viewportHeight 为 0 时不崩溃', () => {
    const range = getVisibleRange({
      scrollTop: 0,
      viewportHeight: 0,
      itemHeight: 32,
      total: 100,
    })

    expect(range.start).toBe(0)
    expect(range.end).toBe(5)
    expect(range.totalHeight).toBe(3200)
  })
})

describe('clampIndex', () => {
  it('钳制到 [0, total] 边界', () => {
    expect(clampIndex(-5, 10)).toBe(0)
    expect(clampIndex(5, 10)).toBe(5)
    expect(clampIndex(50, 10)).toBe(10)
    expect(clampIndex(3, 0)).toBe(0)
    expect(clampIndex(Number.NaN, 10)).toBe(0)
  })
})

describe('scrollTopForIndex', () => {
  it('让目标项居中，首项与非法入参贴顶', () => {
    expect(scrollTopForIndex(100, 32, 256)).toBe(100 * 32 - (256 - 32) / 2)
    expect(scrollTopForIndex(0, 32, 256)).toBe(0)
    expect(scrollTopForIndex(5, 0, 256)).toBe(0)
    expect(scrollTopForIndex(Number.NaN, 32, 256)).toBe(0)
  })
})
