import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type ComputedRef,
  type CSSProperties,
  type Ref,
} from 'vue'

/**
 * 浮层定位（内部件，不进公共 API）。
 *
 * 范围严格限定为：
 * - position: fixed + Teleport 到 body
 * - 默认向下，下方空间不足且上方更大时翻转
 * - 左边缘对齐触发元素，右侧越界时向左收，最小 left = 8px
 * - window scroll（rAF 节流）/ resize 时更新
 * - Esc 或 pointerdown 落在浮层与触发元素之外时 onClose
 *
 * 不做滚动容器跟随、不做任意方向 flip、不做箭头、不做动画。
 */

const DEFAULT_OFFSET = 4
const VIEWPORT_MARGIN = 8
const POPOVER_Z_INDEX = 1000

export interface UsePopoverOptions {
  trigger: Ref<HTMLElement | null>
  content: Ref<HTMLElement | null>
  open: Ref<boolean>
  /** 触发元素与浮层之间的间距，默认 4px */
  offset?: number
  onClose: () => void
}

export interface UsePopoverReturn {
  /** 直接绑到浮层上 */
  style: ComputedRef<CSSProperties>
  update: () => void
}

export function usePopover(options: UsePopoverOptions): UsePopoverReturn {
  const offset = options.offset ?? DEFAULT_OFFSET
  const position = ref({ top: 0, left: 0 })

  const style = computed<CSSProperties>(() => ({
    position: 'fixed',
    top: `${position.value.top}px`,
    left: `${position.value.left}px`,
    zIndex: POPOVER_Z_INDEX,
  }))

  function update(): number {
    if (typeof window === 'undefined') return 0
    const trigger = options.trigger.value
    if (!trigger) return 0

    const rect = trigger.getBoundingClientRect()
    const content = options.content.value
    const height = content?.offsetHeight ?? 0
    const width = content?.offsetWidth ?? 0

    const spaceBelow = window.innerHeight - rect.bottom - offset
    const spaceAbove = rect.top - offset
    const flipUp = height > 0 && height > spaceBelow && spaceAbove > spaceBelow

    let top = flipUp ? rect.top - height - offset : rect.bottom + offset

    // 高度未知时先不夹取，等测量帧拿到真实高度后再算
    if (height > 0) {
      top = flipUp
        ? Math.max(VIEWPORT_MARGIN, top)
        : Math.min(top, window.innerHeight - height - VIEWPORT_MARGIN)
    }

    let left = rect.left
    if (width > 0 && left + width > window.innerWidth - VIEWPORT_MARGIN) {
      left = window.innerWidth - width - VIEWPORT_MARGIN
    }
    left = Math.max(VIEWPORT_MARGIN, left)

    position.value = { top, left }
    return height
  }

  let frame = 0
  let measureFrame = 0

  function cancelMeasure() {
    if (measureFrame !== 0 && typeof window !== 'undefined') {
      window.cancelAnimationFrame(measureFrame)
    }
    measureFrame = 0
  }

  /** 打开首帧 offsetHeight 可能还是 0，逐帧重试，最多 3 帧 */
  function measureAndUpdate(remaining = 3) {
    if (typeof window === 'undefined') return
    cancelMeasure()

    function step(left: number) {
      measureFrame = window.requestAnimationFrame(() => {
        measureFrame = 0
        const height = update()
        if (height > 0 || left <= 1) return
        step(left - 1)
      })
    }

    step(remaining)
  }

  function scheduleUpdate() {
    if (frame !== 0) return
    frame = window.requestAnimationFrame(() => {
      frame = 0
      update()
    })
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') options.onClose()
  }

  function onPointerDown(event: Event) {
    const target = event.target as Node | null
    if (!target) return
    if (options.content.value?.contains(target)) return
    if (options.trigger.value?.contains(target)) return
    options.onClose()
  }

  let attached = false

  function attach() {
    if (attached || typeof window === 'undefined') return
    attached = true
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)
    document.addEventListener('keydown', onKeydown)
    document.addEventListener('pointerdown', onPointerDown)
  }

  function detach() {
    cancelMeasure()
    if (!attached || typeof window === 'undefined') return
    attached = false
    window.removeEventListener('scroll', scheduleUpdate)
    window.removeEventListener('resize', scheduleUpdate)
    document.removeEventListener('keydown', onKeydown)
    document.removeEventListener('pointerdown', onPointerDown)
    if (frame !== 0) {
      window.cancelAnimationFrame(frame)
      frame = 0
    }
  }

  watch(
    options.open,
    (open) => {
      if (open) {
        attach()
        measureAndUpdate()
      } else {
        detach()
      }
    },
    { immediate: true },
  )

  // Teleport 的内容节点在打开后才挂载，ref 落地时补一次定位
  watch(options.content, (element) => {
    if (element && options.open.value) update()
  })

  onMounted(() => {
    if (options.open.value) measureAndUpdate()
  })

  onBeforeUnmount(detach)

  return { style, update }
}
