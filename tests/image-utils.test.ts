import { describe, expect, it } from 'vitest'

import { checkFile, computeTargetSize, formatBytes } from '../src/utils/image'

describe('computeTargetSize', () => {
  it('超宽时等比缩放并取整', () => {
    expect(computeTargetSize({ width: 3000, height: 2000, maxWidth: 1600 })).toEqual({
      width: 1600,
      height: 1067,
    })
    expect(computeTargetSize({ width: 4000, height: 1000, maxWidth: 1600 })).toEqual({
      width: 1600,
      height: 400,
    })
  })

  it('宽度不超过 maxWidth 时原样返回', () => {
    expect(computeTargetSize({ width: 800, height: 600, maxWidth: 1600 })).toEqual({
      width: 800,
      height: 600,
    })
    expect(computeTargetSize({ width: 1600, height: 900, maxWidth: 1600 })).toEqual({
      width: 1600,
      height: 900,
    })
  })

  it('极端窄高或超宽扁图不变形，宽高不小于 1', () => {
    expect(computeTargetSize({ width: 500, height: 10000, maxWidth: 1600 })).toEqual({
      width: 500,
      height: 10000,
    })
    expect(computeTargetSize({ width: 4000, height: 1, maxWidth: 1600 })).toEqual({
      width: 1600,
      height: 1,
    })
    expect(computeTargetSize({ width: 0, height: 0, maxWidth: 1600 })).toEqual({
      width: 1,
      height: 1,
    })
  })
})

describe('formatBytes', () => {
  it('四档体积格式化', () => {
    expect(formatBytes(1023)).toBe('1023 B')
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(1048576)).toBe('1.0 MB')
  })
})

describe('checkFile', () => {
  it('类型不符时返回 ok:false 与中文 message', () => {
    const result = checkFile(
      { type: 'text/plain', size: 100 },
      { accept: 'image/*', maxSize: 1024 },
    )

    expect(result.ok).toBe(false)
    expect(result.message).toContain('文件类型不支持')
  })

  it('超过 maxSize 时返回 ok:false 与中文 message', () => {
    const result = checkFile(
      { type: 'image/png', size: 2 * 1024 * 1024 },
      { accept: 'image/*', maxSize: 1024 * 1024 },
    )

    expect(result.ok).toBe(false)
    expect(result.message).toContain('文件大小超出限制')
    expect(result.message).toContain('1.0 MB')
  })

  it('类型与体积都通过时返回 ok:true', () => {
    expect(
      checkFile({ type: 'image/jpeg', size: 1024 }, { accept: 'image/png,image/jpeg', maxSize: 2048 }),
    ).toEqual({ ok: true })
    expect(checkFile({ type: 'image/webp', size: 512 }, { accept: 'image/*' })).toEqual({
      ok: true,
    })
  })
})
