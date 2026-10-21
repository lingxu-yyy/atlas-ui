import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'

import AtProTable from '../src/components/AtProTable/AtProTable.vue'
import AtSearchForm from '../src/components/AtSearchForm/AtSearchForm.vue'

import type { FieldDef } from '../src/types/schema'
import type { AtSearchFormSearchPayload } from '../src/components/AtSearchForm/types'
import { orderFields } from './fixtures/order-fields'
import { productFields } from './fixtures/product-fields'

function mountForm(props: Record<string, unknown> = {}) {
  return mount(AtSearchForm, { props: { fields: orderFields, ...props } })
}

function labelFor(wrapper: ReturnType<typeof mountForm>, text: string) {
  return wrapper.findAll('label').find((label) => label.text().includes(text))
}

function controlFor(wrapper: ReturnType<typeof mountForm>, text: string) {
  const label = labelFor(wrapper, text)
  if (!label) throw new Error(`未找到 label: ${text}`)
  return wrapper.find(`[id="${label.attributes('for')}"]`)
}

function searchPayload(wrapper: ReturnType<typeof mountForm>): AtSearchFormSearchPayload {
  const events = wrapper.emitted('search')
  if (!events) throw new Error('未触发 search')
  return events[events.length - 1][0] as AtSearchFormSearchPayload
}

describe('AtSearchForm 可见性', () => {
  it('只渲染可搜索字段：searchable:false 的 SKU 不出现', () => {
    const wrapper = mountForm({ fields: productFields, collapsible: false })

    expect(labelFor(wrapper, 'SKU')).toBeUndefined()
    expect(labelFor(wrapper, '商品名')).toBeDefined()
  })

  it('custom 字段不渲染（订单操作列）', () => {
    const wrapper = mountForm()

    expect(labelFor(wrapper, '操作')).toBeUndefined()
  })
})

describe('AtSearchForm 控件形态', () => {
  it('text 渲染 input，number 渲染 input[type=number]', () => {
    const wrapper = mountForm()

    expect(controlFor(wrapper, '客户名').element.tagName).toBe('INPUT')
    expect(controlFor(wrapper, '客户名').attributes('type')).toBe('text')

    expect(controlFor(wrapper, '商品数').element.tagName).toBe('INPUT')
    expect(controlFor(wrapper, '商品数').attributes('type')).toBe('number')
  })

  it('单选渲染普通 select，多选带 multiple 属性', () => {
    const wrapper = mountForm({ fields: productFields, collapsible: false })

    const single = controlFor(wrapper, '类目')
    expect(single.element.tagName).toBe('SELECT')
    expect(single.attributes('multiple')).toBeUndefined()

    const multiple = controlFor(wrapper, '标签')
    expect(multiple.element.tagName).toBe('SELECT')
    expect(multiple.attributes('multiple')).toBeDefined()
  })

  it('label 的 for 与控件 id 一一对应', () => {
    const wrapper = mountForm()

    const labels = wrapper.findAll('label')
    expect(labels.length).toBeGreaterThan(0)
    labels.forEach((label) => {
      const id = label.attributes('for')
      expect(id).toBeTruthy()
      expect(wrapper.find(`[id="${id}"]`).exists()).toBe(true)
    })
  })
})

describe('AtSearchForm 查询与条件', () => {
  it('输入后点查询 emit search，values 正确', async () => {
    const wrapper = mountForm()

    await controlFor(wrapper, '客户名').setValue('张三')
    await wrapper.find('button[type="submit"]').trigger('click')

    const payload = searchPayload(wrapper)
    expect(payload.values.customerName).toBe('张三')
    expect(payload.conditions).toContainEqual({
      key: 'customerName',
      operator: 'like',
      value: '张三',
    })
  })

  it('conditions 映射：text→like、date 范围→between、select 多选→in、boolean→eq', async () => {
    const fields: FieldDef[] = [
      { key: 'name', label: '名称', type: 'text' },
      { key: 'period', label: '区间', type: 'date', range: true },
      {
        key: 'tags',
        label: '标签',
        type: 'select',
        multiple: true,
        options: [
          { label: '热销', value: 'hot' },
          { label: '新品', value: 'new' },
        ],
      },
      { key: 'enabled', label: '启用', type: 'boolean' },
    ]

    const wrapper = mountForm({
      fields,
      modelValue: {
        name: '手机',
        period: ['2026-01-01', '2026-01-31'],
        tags: ['hot'],
        enabled: true,
      },
    })

    await wrapper.find('form').trigger('submit')

    expect(searchPayload(wrapper).conditions).toEqual([
      { key: 'name', operator: 'like', value: '手机' },
      { key: 'period', operator: 'between', value: ['2026-01-01', '2026-01-31'] },
      { key: 'tags', operator: 'in', value: ['hot'] },
      { key: 'enabled', operator: 'eq', value: true },
    ])
  })

  it('空值不进入 conditions 与 values', async () => {
    const fields: FieldDef[] = [
      { key: 'name', label: '名称', type: 'text' },
      {
        key: 'tags',
        label: '标签',
        type: 'select',
        multiple: true,
        options: [{ label: '热销', value: 'hot' }],
      },
    ]

    const wrapper = mountForm({ fields })
    await wrapper.find('form').trigger('submit')

    expect(searchPayload(wrapper).conditions).toEqual([])
    expect(searchPayload(wrapper).values).toEqual({})
  })

  it('布尔字段未选择时为「全部」，主动选「否」才进入 conditions', async () => {
    const wrapper = mountForm()

    const toggle = wrapper.findAll('button').find((button) => button.text() === '展开')
    await toggle!.trigger('click')

    expect((controlFor(wrapper, '是否加急').element as HTMLSelectElement).value).toBe('')

    await wrapper.find('form').trigger('submit')
    expect(
      searchPayload(wrapper).conditions.every((condition) => condition.key !== 'urgent'),
    ).toBe(true)

    await controlFor(wrapper, '是否加急').setValue('false')
    await wrapper.find('form').trigger('submit')
    expect(searchPayload(wrapper).conditions).toContainEqual({
      key: 'urgent',
      operator: 'eq',
      value: false,
    })
  })

  it('输入框内回车（表单 submit）触发 search', async () => {
    const wrapper = mountForm()

    await controlFor(wrapper, '客户名').setValue('李四')
    await wrapper.find('form').trigger('submit')

    expect(searchPayload(wrapper).values.customerName).toBe('李四')
  })

  it('重置恢复 getDefaultValue，并 emit reset 与 update:modelValue', async () => {
    const wrapper = mountForm()

    await controlFor(wrapper, '客户名').setValue('王五')
    const resetButton = wrapper
      .findAll('button')
      .find((button) => button.text() === '重置')
    await resetButton!.trigger('click')

    expect(controlFor(wrapper, '客户名').element).toHaveProperty('value', '')
    expect(wrapper.emitted('reset')).toHaveLength(1)

    const updates = wrapper.emitted('update:modelValue')
    expect(updates?.length).toBeGreaterThanOrEqual(2)

    const updated = updates?.[updates.length - 1][0] as Record<string, unknown>
    expect(updated.customerName).toBe('')
    expect(updated.itemCount).toBeUndefined()
  })
})

describe('AtSearchForm 折叠与共用字段', () => {
  it('collapsible 展开后字段数量增加', async () => {
    const wrapper = mountForm()

    expect(wrapper.findAll('.at-search-form__item')).toHaveLength(6)

    const toggle = wrapper
      .findAll('button')
      .find((button) => button.text() === '展开')
    await toggle!.trigger('click')

    expect(wrapper.findAll('.at-search-form__item')).toHaveLength(8)
  })

  it('同一份 orderFields 同时驱动 AtSearchForm 与 AtProTable', () => {
    const Parent = defineComponent({
      components: { AtSearchForm, AtProTable },
      setup() {
        return { orderFields }
      },
      template: `
        <div>
          <AtSearchForm :fields="orderFields" />
          <AtProTable :fields="orderFields" :data="[]" />
        </div>
      `,
    })

    const wrapper = mount(Parent)

    expect(wrapper.findAll('.at-search-form__item').length).toBeGreaterThan(0)
    expect(wrapper.findAll('th').length).toBe(orderFields.length)
  })
})
