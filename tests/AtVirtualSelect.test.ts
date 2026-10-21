import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref, type PropType } from 'vue'

import AtVirtualSelect from '../src/components/AtVirtualSelect/AtVirtualSelect.vue'
import { usePopover } from '../src/composables/usePopover'
import type { FieldOption, SelectField } from '../src/types/schema'

enableAutoUnmount(afterEach)

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const localField: SelectField = {
  key: 'fruit',
  label: '水果',
  type: 'select',
  filterable: true,
  options: [
    { label: '苹果', value: 'apple' },
    { label: '香蕉', value: 'banana' },
    { label: '橙子', value: 'orange' },
  ],
}

function mountSelect(props: Record<string, unknown> = {}) {
  return mount(AtVirtualSelect, {
    props: { field: localField, ...props },
  })
}

function combobox(wrapper: ReturnType<typeof mountSelect>) {
  return wrapper.find('[role="combobox"]')
}

function panelEl(): HTMLElement | null {
  return document.body.querySelector('.at-virtual-select__panel')
}

function optionEls(): HTMLElement[] {
  return Array.from(document.body.querySelectorAll('[role="option"]'))
}

function optionTexts(): string[] {
  return optionEls().map((element) => element.textContent?.trim() ?? '')
}

function bigOptions(): FieldOption[] {
  return Array.from({ length: 10000 }, (_, index) => ({
    label: `选项 ${index + 1}`,
    value: index + 1,
  }))
}

describe('AtVirtualSelect 虚拟滚动', () => {
  it('1 万条 options 时 DOM 中 option 节点数 ≤ 40', async () => {
    const wrapper = mountSelect({
      field: { ...localField, filterable: false, options: bigOptions() },
    })

    await combobox(wrapper).trigger('click')

    expect(optionEls().length).toBeGreaterThan(0)
    expect(optionEls().length).toBeLessThanOrEqual(40)
  })

  it('滚动到中部后渲染中部区间，首项文本正确', async () => {
    const wrapper = mountSelect({
      field: { ...localField, filterable: false, options: bigOptions() },
    })

    await combobox(wrapper).trigger('click')

    const list = panelEl()!.querySelector('.at-virtual-select__list') as HTMLElement
    Object.defineProperty(list, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 5000 * 32,
    })
    list.dispatchEvent(new Event('scroll'))
    await nextTick()

    expect(optionTexts()[0]).toBe('选项 4997')
    expect(optionEls().length).toBeLessThanOrEqual(40)
  })
})

describe('AtVirtualSelect 交互', () => {
  it('↑↓ 移动高亮，Enter 选中并 emit update:modelValue', async () => {
    const wrapper = mountSelect()

    await combobox(wrapper).trigger('keydown', { key: 'ArrowDown' })
    expect(combobox(wrapper).attributes('aria-activedescendant')).toBeTruthy()

    await combobox(wrapper).trigger('keydown', { key: 'ArrowDown' })
    await combobox(wrapper).trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toBe('banana')
  })

  it('多选：选中两项后 tag 数量为 2，点 × 移除一项', async () => {
    const wrapper = mountSelect({ field: { ...localField, filterable: false, multiple: true } })
    await combobox(wrapper).trigger('click')

    optionEls()[0].click()
    await nextTick()
    await wrapper.setProps({ modelValue: wrapper.emitted('update:modelValue')!.at(-1)![0] })

    optionEls()[1].click()
    await nextTick()
    await wrapper.setProps({ modelValue: wrapper.emitted('update:modelValue')!.at(-1)![0] })

    expect(wrapper.findAll('.at-virtual-select__tag')).toHaveLength(2)

    await wrapper.find('.at-virtual-select__tag-remove').trigger('click')
    await wrapper.setProps({ modelValue: wrapper.emitted('update:modelValue')!.at(-1)![0] })

    expect(wrapper.findAll('.at-virtual-select__tag')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')!.at(-1)![0]).toEqual(['banana'])
  })

  it('filterable：输入关键词后列表只剩匹配项', async () => {
    const wrapper = mountSelect()
    await combobox(wrapper).trigger('click')

    await wrapper.find('.at-virtual-select__search').setValue('香')

    expect(optionTexts()).toEqual(['香蕉'])
  })

  it('远程：loadOptions 防抖 300ms 后调用一次', async () => {
    vi.useFakeTimers()
    const loader = vi.fn(async (): Promise<FieldOption[]> => [
      { label: '远程 A', value: 'a' },
      { label: '远程 B', value: 'b' },
    ])

    const wrapper = mountSelect({
      field: {
        key: 'remote',
        label: '远程商品',
        type: 'select',
        filterable: true,
        loadOptions: loader,
      },
    })

    await combobox(wrapper).trigger('click')
    expect(loader).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(299)
    expect(loader).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('无匹配项时显示空态文案', async () => {
    const wrapper = mountSelect()
    await combobox(wrapper).trigger('click')

    await wrapper.find('.at-virtual-select__search').setValue('西瓜')

    expect(panelEl()!.textContent).toContain('无匹配项')
  })

  it('aria 属性齐全：combobox / aria-expanded / listbox / option', async () => {
    const wrapper = mountSelect()
    const box = combobox(wrapper)

    expect(box.attributes('role')).toBe('combobox')
    expect(box.attributes('aria-expanded')).toBe('false')
    expect(box.attributes('aria-controls')).toBeTruthy()

    await box.trigger('click')

    expect(combobox(wrapper).attributes('aria-expanded')).toBe('true')

    const listbox = document.body.querySelector('[role="listbox"]')
    expect(listbox).not.toBeNull()
    expect(listbox!.id).toBe(box.attributes('aria-controls'))

    const first = optionEls()[0]
    expect(first.getAttribute('role')).toBe('option')
    expect(first.getAttribute('aria-selected')).toBe('false')
  })

  it('Esc 关闭面板且不改变已选值', async () => {
    const wrapper = mountSelect({ modelValue: 'apple' })
    await combobox(wrapper).trigger('click')
    expect(panelEl()).not.toBeNull()

    await combobox(wrapper).trigger('keydown', { key: 'Escape' })

    expect(panelEl()).toBeNull()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})

/* ---------- usePopover ---------- */

const PopoverHost = defineComponent({
  props: {
    onClose: { type: Function as PropType<() => void>, required: true },
  },
  setup(props, { expose }) {
    const trigger = ref<HTMLElement | null>(null)
    const content = ref<HTMLElement | null>(null)
    const open = ref(true)

    const { style, update } = usePopover({
      trigger,
      content,
      open,
      onClose: () => {
        props.onClose()
        open.value = false
      },
    })

    expose({
      update,
      setOpen: (value: boolean) => {
        open.value = value
      },
    })

    return () =>
      h('div', [
        h('button', { ref: trigger, class: 'popover-trigger' }, 'trigger'),
        h('div', { ref: content, class: 'popover-content', style: style.value }, 'content'),
      ])
  },
})

function mountPopover() {
  const onClose = vi.fn()
  const wrapper = mount(PopoverHost, { props: { onClose } })
  return { wrapper, onClose }
}

function mockTriggerRect(
  wrapper: ReturnType<typeof mountPopover>['wrapper'],
  rect: { top: number; bottom: number; left: number },
) {
  const element = wrapper.find('.popover-trigger').element as HTMLElement
  element.getBoundingClientRect = () =>
    ({
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.left + 160,
      x: rect.left,
      y: rect.top,
      width: 160,
      height: rect.bottom - rect.top,
      toJSON: () => ({}),
    }) as DOMRect
}

function mockContentMetrics(
  wrapper: ReturnType<typeof mountPopover>['wrapper'],
  height: number,
  width: number,
) {
  const element = wrapper.find('.popover-content').element as HTMLElement
  Object.defineProperty(element, 'offsetHeight', { configurable: true, value: height })
  Object.defineProperty(element, 'offsetWidth', { configurable: true, value: width })
}

function contentStyle(wrapper: ReturnType<typeof mountPopover>['wrapper']) {
  return (wrapper.find('.popover-content').element as HTMLElement).style
}

function runUpdate(wrapper: ReturnType<typeof mountPopover>['wrapper']) {
  ;(wrapper.vm as unknown as { update: () => void }).update()
}

describe('usePopover 定位', () => {
  it('默认向下展开，左边缘对齐触发元素', async () => {
    const { wrapper } = mountPopover()
    mockTriggerRect(wrapper, { top: 100, bottom: 140, left: 40 })
    mockContentMetrics(wrapper, 200, 200)
    runUpdate(wrapper)
    await nextTick()

    expect(contentStyle(wrapper).position).toBe('fixed')
    expect(contentStyle(wrapper).top).toBe('144px')
    expect(contentStyle(wrapper).left).toBe('40px')
  })

  it('下方空间不足且上方更大时翻转到上方', async () => {
    const { wrapper } = mountPopover()
    mockTriggerRect(wrapper, { top: 600, bottom: 640, left: 40 })
    mockContentMetrics(wrapper, 200, 200)
    runUpdate(wrapper)
    await nextTick()

    expect(contentStyle(wrapper).top).toBe('396px')
  })

  it('Esc 与外部 pointerdown 触发 onClose', async () => {
    const first = mountPopover()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(first.onClose).toHaveBeenCalledTimes(1)
    await nextTick()

    const second = mountPopover()
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(second.onClose).toHaveBeenCalledTimes(1)
    await flushPromises()
  })

  it('首帧测不到高度时逐帧重试，第二帧拿到 300 后上翻', async () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => undefined)

    const { wrapper } = mountPopover()
    const vm = wrapper.vm as unknown as { setOpen: (value: boolean) => void }

    vm.setOpen(false)
    await nextTick()

    mockTriggerRect(wrapper, { top: 600, bottom: 640, left: 40 })

    const content = wrapper.find('.popover-content').element as HTMLElement
    let reads = 0
    Object.defineProperty(content, 'offsetHeight', {
      configurable: true,
      get: () => (reads++ === 0 ? 0 : 300),
    })
    Object.defineProperty(content, 'offsetWidth', { configurable: true, value: 200 })

    vm.setOpen(true)
    await nextTick()

    const top = Number.parseFloat(contentStyle(wrapper).top)
    expect(top).toBe(296)
    expect(top).toBeLessThan(600)
  })

  it('上下空间均不足时对向下定位做夹取，底边不超出视口 - 8', async () => {
    const { wrapper } = mountPopover()
    mockTriggerRect(wrapper, { top: 300, bottom: 340, left: 40 })
    mockContentMetrics(wrapper, 500, 200)
    runUpdate(wrapper)
    await nextTick()

    const top = Number.parseFloat(contentStyle(wrapper).top)
    expect(top).toBe(window.innerHeight - 500 - 8)
    expect(top + 500).toBeLessThanOrEqual(window.innerHeight - 8)
  })
})
