import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { AtButton } from '../src/index'

describe('AtButton', () => {
  it('默认渲染：primary + md + type=button', () => {
    const wrapper = mount(AtButton, { slots: { default: '确定' } })
    const el = wrapper.element as HTMLButtonElement
    expect(el.classList.contains('at-button')).toBe(true)
    expect(el.classList.contains('at-button--primary')).toBe(true)
    expect(el.classList.contains('at-button--md')).toBe(true)
    expect(el.type).toBe('button')
    expect(wrapper.text()).toBe('确定')
  })

  it('三种 variant 各自带对应 class', () => {
    for (const variant of ['primary', 'secondary', 'text'] as const) {
      const wrapper = mount(AtButton, { props: { variant } })
      expect(wrapper.element.classList.contains(`at-button--${variant}`)).toBe(true)
    }
  })

  it('三种 size 各自带对应 class', () => {
    for (const size of ['sm', 'md', 'lg'] as const) {
      const wrapper = mount(AtButton, { props: { size } })
      expect(wrapper.element.classList.contains(`at-button--${size}`)).toBe(true)
    }
  })

  it('disabled 时不触发 click', async () => {
    const onClick = vi.fn()
    const wrapper = mount(AtButton, { props: { disabled: true, onClick } })
    await wrapper.trigger('click')
    expect(onClick).not.toHaveBeenCalled()
    expect((wrapper.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('loading 时不触发 click，且 aria-busy="true"、显示 spinner', async () => {
    const onClick = vi.fn()
    const wrapper = mount(AtButton, { props: { loading: true, onClick } })
    await wrapper.trigger('click')
    expect(onClick).not.toHaveBeenCalled()
    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.find('.at-button__spinner').exists()).toBe(true)
  })

  it('正常状态点击触发 click 一次', async () => {
    const onClick = vi.fn()
    const wrapper = mount(AtButton, { props: { onClick } })
    await wrapper.trigger('click')
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('attrs 透传：data-* 透传且 class 不重复绑定', () => {
    const wrapper = mount(AtButton, {
      attrs: { 'data-testid': 'submit-btn', class: 'my-extra' },
    })
    expect(wrapper.attributes('data-testid')).toBe('submit-btn')
    // class 只绑定一次：my-extra 在 class 列表中只出现一次
    const className: string = wrapper.element.className
    expect(className.split(/\s+/).filter((c: string) => c === 'my-extra')).toHaveLength(1)
  })

  it('样式表包含 :focus-visible 规则（a11y 底线）', () => {
    const source = readFileSync(
      resolve(__dirname, '../src/components/AtButton/AtButton.vue'),
      'utf-8',
    )
    expect(source).toContain(':focus-visible')
    expect(source).toContain('outline: 2px solid var(--at-color-primary)')
  })

  it('文档页场景：点击后父级 loading 置 true，组件进入并恢复 loading 态', async () => {
    const Demo = defineComponent({
      components: { AtButton },
      setup() {
        const loading = ref(false)
        const simulate = () => {
          loading.value = true
        }
        return { loading, simulate }
      },
      template: `<AtButton :loading="loading" @click="simulate">{{ loading ? '提交中' : '模拟提交' }}</AtButton>`,
    })
    const wrapper = mount(Demo)
    const btn = wrapper.find('button')
    expect(btn.text()).toBe('模拟提交')
    await btn.trigger('click')
    expect(wrapper.find('button').attributes('aria-busy')).toBe('true')
    expect(wrapper.find('button').text()).toContain('提交中')
    expect(wrapper.find('.at-button__spinner').exists()).toBe(true)
  })
})
