/**
 * 图片处理的纯函数层：不接触 DOM、不读文件，只做尺寸与校验计算。
 */

export interface TargetSizeInput {
  width: number
  height: number
  maxWidth: number
}

/** 等比缩放到宽度不超过 maxWidth；本来就够小则原样返回，宽高取整且不小于 1 */
export function computeTargetSize(input: TargetSizeInput): { width: number; height: number } {
  const { width, height, maxWidth } = input

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: 1, height: 1 }
  }

  const safeWidth = Math.max(1, Math.round(width))
  const safeHeight = Math.max(1, Math.round(height))

  if (!Number.isFinite(maxWidth) || maxWidth <= 0 || width <= maxWidth) {
    return { width: safeWidth, height: safeHeight }
  }

  const targetWidth = Math.max(1, Math.floor(maxWidth))
  return {
    width: targetWidth,
    height: Math.max(1, Math.round((height * targetWidth) / width)),
  }
}

const KB = 1024
const MB = KB * 1024
const GB = MB * 1024

/** 人类可读体积：1023 B / 1.0 KB / 1.5 KB / 1.0 MB */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < KB) return `${Math.round(bytes)} B`
  if (bytes < MB) return `${(bytes / KB).toFixed(1)} KB`
  if (bytes < GB) return `${(bytes / MB).toFixed(1)} MB`
  return `${(bytes / GB).toFixed(1)} GB`
}

export interface FileCheckResult {
  ok: boolean
  message?: string
}

/**
 * 校验文件类型与体积。
 * accept 支持 'image/*' 与 'image/png,image/jpeg' 两种写法。
 */
export function checkFile(
  file: { type: string; size: number },
  options: { accept?: string; maxSize?: number },
): FileCheckResult {
  const accept = options.accept?.trim()
  if (accept) {
    const patterns = accept
      .split(',')
      .map((pattern) => pattern.trim().toLowerCase())
      .filter(Boolean)

    const type = file.type.toLowerCase()
    const matched = patterns.some((pattern) => {
      if (pattern === '*' || pattern === '*/*') return true
      if (pattern.endsWith('/*')) return type.startsWith(pattern.slice(0, -1))
      return type === pattern
    })

    if (!matched) {
      return { ok: false, message: `文件类型不支持，仅支持 ${accept}` }
    }
  }

  const maxSize = options.maxSize
  if (maxSize !== undefined && maxSize > 0 && file.size > maxSize) {
    return { ok: false, message: `文件大小超出限制，最大 ${formatBytes(maxSize)}` }
  }

  return { ok: true }
}
