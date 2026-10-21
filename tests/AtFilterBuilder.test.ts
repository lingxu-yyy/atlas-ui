import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AtFilterBuilder from '../src/components/AtFilterBuilder/AtFilterBuilder.vue'
import type { FilterGroup, FilterNode } from '../src/components/AtFilterBuilder/types'
import { orderFields } from './fixtures/order-fields'

type Wrapper = ReturnType<typeof mountBuilder>

function mountBuilder(props: Record<string, unknown> = {}) {
  return mount(AtFilterBuilder, { props: { fields: orderFields, ...props } })
}

function lastEmit(
  wrapper: Wrapper,
  event: 'update:modelValue' | 'change' = 'update:modelValue',
): FilterNode | null {
  const events = wrapper.emitted(event)
  if (!events || events.length === 0) throw new Error(`未触发 ${event}`)
  return events[events.length - 1][0] as FilterNode | null
}

function rootGroup(node: FilterNode | null): FilterGroup {
  if (!node || node.type !== 'group') throw new Error('期望根组')
  return node
}

function keyOf(label: string): string {
  const field = orderFields.find((item) => item.label === label)
  if (!field) throw new Error(`未找到字段: ${label}`)
  return field.key
}

function fieldSelects(wrapper: Wrapper) {
  return wrapper.findAll('.at-filter-builder__field')
}

function operatorSelects(wrapper: Wrapper) {
  return wrapper.findAll('.at-filter-builder__operator')
}

async function setField(wrapper: Wrapper, label: string, index = 0) {
  await fieldSelects(wrapper)[index].setValue(keyOf(label))
}

function operatorValues(wrapper: Wrapper, index = 0): string[] {
  return operatorSelects(wrapper)
    [index].findAll('option')
    .map((option) => option.attributes('value') ?? '')
}

async function addCondition(wrapper: Wrapper, index = 0) {
  await wrapper.findAll('.at-filter-builder__add-condition')[index].trigger('click')
}

async function addGroup(wrapper: Wrapper, index = 0) {
  await wrapper.findAll('.at-filter-builder__add-group')[index].trigger('click')
}

const filledModel: FilterGroup = {
  type: 'group',
  logic: 'or',
  children: [
    { type: 'condition', key: 'customerName', operator: 'like', value: '张三' },
    {
      type: 'group',
      logic: 'and',
      children: [
        { type: 'condition', key: 'amount', operator: 'between', value: [100, 500] },
        { type: 'condition', key: 'status', operator: 'in', value: ['shipped', 'pending'] },
        { type: 'condition', key: 'urgent', operator: 'eq', value: true },
      ],
    },
  ],
}

describe('AtFilterBuilder 基本交互', () => {
  it('添加条件：新增一行，填值后 emit 条件树', async () => {
    const wrapper = mountBuilder()

    await addCondition(wrapper)
    expect(wrapper.findAll('.at-filter-builder__row')).toHaveLength(1)

    await setField(wrapper, '客户名')
    await wrapper.find('.at-filter-builder__input').setValue('张三')

    expect(rootGroup(lastEmit(wrapper)).children).toEqual([
      { type: 'condition', key: 'customerName', operator: 'like', value: '张三' },
    ])
  })

  it('运算符按字段类型过滤，不把全部 operator 列出来', async () => {
    const wrapper = mountBuilder()

    await addCondition(wrapper)
    expect(operatorValues(wrapper)).toEqual(['like', 'eq'])

    await setField(wrapper, '订单金额')
    expect(operatorValues(wrapper)).toEqual(['eq', 'gt', 'gte', 'lt', 'lte', 'between'])

    await setField(wrapper, '下单时间')
    expect(operatorValues(wrapper)).toEqual(['eq', 'between', 'gt', 'lt'])

    await setField(wrapper, '订单状态')
    expect(operatorValues(wrapper)).toEqual(['eq', 'in'])

    await setField(wrapper, '是否加急')
    expect(operatorValues(wrapper)).toEqual(['eq'])
  })

  it('切到 between 后渲染两个输入框，值按数组 emit', async () => {
    const wrapper = mountBuilder()

    await addCondition(wrapper)
    await setField(wrapper, '订单金额')
    await operatorSelects(wrapper)[0].setValue('between')

    const inputs = wrapper.findAll('.at-filter-builder__range input')
    expect(inputs).toHaveLength(2)
    expect(inputs[0].attributes('type')).toBe('number')
    expect(inputs[1].attributes('type')).toBe('number')

    await inputs[0].setValue('100')
    await inputs[1].setValue('500')

    expect(rootGroup(lastEmit(wrapper)).children[0]).toMatchObject({
      operator: 'between',
      value: [100, 500],
    })
  })
})

describe('AtFilterBuilder 剪枝', () => {
  it('空值叶子被剪掉，整棵树为空时 emit null', async () => {
    const wrapper = mountBuilder()

    await addCondition(wrapper)
    await setField(wrapper, '客户名')
    expect(wrapper.find('.at-filter-builder__input').element).toHaveProperty('value', '')

    expect(lastEmit(wrapper)).toBeNull()
  })

  it('空组被剪掉，全空时 emit null；填值后组保留', async () => {
    const wrapper = mountBuilder()

    await addGroup(wrapper)
    expect(wrapper.findAll('.at-filter-builder__group')).toHaveLength(2)
    expect(lastEmit(wrapper)).toBeNull()

    await addCondition(wrapper, 1)
    await setField(wrapper, '订单状态')
    await wrapper.find('.at-filter-builder__select').setValue('shipped')

    const root = rootGroup(lastEmit(wrapper))
    expect(root.children).toHaveLength(1)
    expect(root.children[0]).toMatchObject({
      type: 'group',
      children: [{ key: 'status', operator: 'eq', value: 'shipped' }],
    })
  })

  it('到达 maxDepth 后「添加分组」按钮禁用', async () => {
    const shallow = mountBuilder({ maxDepth: 1 })
    expect(shallow.find('.at-filter-builder__add-group').attributes('disabled')).toBeDefined()

    const wrapper = mountBuilder({ maxDepth: 2 })
    await addGroup(wrapper)

    const buttons = wrapper.findAll('.at-filter-builder__add-group')
    expect(buttons).toHaveLength(2)
    expect(buttons[0].attributes('disabled')).toBeUndefined()
    expect(buttons[1].attributes('disabled')).toBeDefined()
  })
})

describe('AtFilterBuilder 逻辑与回填', () => {
  it('AND / OR 切换后 emit 新的 logic', async () => {
    const wrapper = mountBuilder()

    await addCondition(wrapper)
    await setField(wrapper, '客户名')
    await wrapper.find('.at-filter-builder__input').setValue('张三')

    expect(rootGroup(lastEmit(wrapper)).logic).toBe('and')

    await wrapper.find('.at-filter-builder__logic').setValue('or')

    expect(rootGroup(lastEmit(wrapper)).logic).toBe('or')
  })

  it('回填 modelValue 时还原根组、嵌套组与各类控件', () => {
    const wrapper = mountBuilder({ modelValue: filledModel })

    const logic = wrapper.findAll('.at-filter-builder__logic')
    expect((logic[0].element as HTMLSelectElement).value).toBe('or')
    expect((logic[1].element as HTMLSelectElement).value).toBe('and')

    expect(
      fieldSelects(wrapper).map((select) => (select.element as HTMLSelectElement).value),
    ).toEqual(['customerName', 'amount', 'status', 'urgent'])

    expect(
      operatorSelects(wrapper).map((select) => (select.element as HTMLSelectElement).value),
    ).toEqual(['like', 'between', 'in', 'eq'])

    expect(wrapper.find('.at-filter-builder__input').element).toHaveProperty('value', '张三')

    const range = wrapper.findAll('.at-filter-builder__range input')
    expect(range[0].element).toHaveProperty('value', '100')
    expect(range[1].element).toHaveProperty('value', '500')

    const multiple = wrapper.findAll('.at-filter-builder__select[multiple]')[0]
    const selected = Array.from((multiple.element as HTMLSelectElement).selectedOptions).map(
      (option) => option.value,
    )
    // selectedOptions 按 DOM 中 option 的顺序返回（订单状态枚举顺序）
    expect(selected).toEqual(['pending', 'shipped'])

    // 只有布尔条件使用单选下拉；状态 in 用的是多选下拉
    const booleans = wrapper.findAll('.at-filter-builder__select:not([multiple])')
    expect(booleans).toHaveLength(1)
    expect((booleans[0].element as HTMLSelectElement).value).toBe('true')
  })

  it('回填时未知 key 静默丢弃，不报错', async () => {
    const model: FilterGroup = {
      type: 'group',
      logic: 'and',
      children: [
        { type: 'condition', key: 'ghost', operator: 'eq', value: 'x' },
        { type: 'condition', key: 'customerName', operator: 'like', value: '张三' },
      ],
    }

    const wrapper = mountBuilder({ modelValue: model })

    expect(fieldSelects(wrapper)).toHaveLength(1)
    expect(
      (fieldSelects(wrapper)[0].element as HTMLSelectElement).value,
    ).toBe('customerName')

    await wrapper.find('.at-filter-builder__input').setValue('李四')

    const payload = lastEmit(wrapper)
    expect(JSON.stringify(payload)).not.toContain('ghost')
  })

  it('删除叶子后只剩其余条件', async () => {
    const model: FilterGroup = {
      type: 'group',
      logic: 'and',
      children: [
        { type: 'condition', key: 'customerName', operator: 'like', value: '张三' },
        { type: 'condition', key: 'status', operator: 'eq', value: 'shipped' },
      ],
    }

    const wrapper = mountBuilder({ modelValue: model })
    expect(wrapper.findAll('.at-filter-builder__row')).toHaveLength(2)

    await wrapper.findAll('.at-filter-builder__remove')[0].trigger('click')

    expect(wrapper.findAll('.at-filter-builder__row')).toHaveLength(1)
    expect(rootGroup(lastEmit(wrapper)).children).toEqual([
      { type: 'condition', key: 'status', operator: 'eq', value: 'shipped' },
    ])
  })
})

describe('AtFilterBuilder 输出稳定性与禁用', () => {
  it('同一棵树连续两次 emit 的 JSON 完全相等', async () => {
    const wrapper = mountBuilder()

    await addCondition(wrapper)
    await setField(wrapper, '客户名')
    await wrapper.find('.at-filter-builder__input').setValue('张三')
    await wrapper.find('.at-filter-builder__input').setValue('张三')

    const events = wrapper.emitted('update:modelValue') ?? []
    expect(events.length).toBeGreaterThanOrEqual(2)

    const previous = JSON.stringify(events[events.length - 2][0])
    const latest = JSON.stringify(events[events.length - 1][0])
    expect(latest).toBe(previous)
  })

  it('update:modelValue 与 change 携带同一份值', async () => {
    const wrapper = mountBuilder()

    await addCondition(wrapper)
    await setField(wrapper, '客户名')
    await wrapper.find('.at-filter-builder__input').setValue('张三')

    expect(JSON.stringify(lastEmit(wrapper, 'change'))).toBe(
      JSON.stringify(lastEmit(wrapper, 'update:modelValue')),
    )
  })

  it('disabled 时所有控件只读且不 emit', async () => {
    const wrapper = mountBuilder({ modelValue: filledModel, disabled: true })

    const controls = wrapper.findAll('input, select, button')
    expect(controls.length).toBeGreaterThan(0)
    controls.forEach((control) => {
      expect(control.attributes('disabled')).toBeDefined()
    })

    await addCondition(wrapper)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})

describe('AtFilterBuilder 验收场景', () => {
  it('构造「状态=已发货 AND (金额>100 OR 加急=是)」', async () => {
    const wrapper = mountBuilder()

    // 根组第一个条件：状态 = 已发货
    await addCondition(wrapper)
    await setField(wrapper, '订单状态')
    await wrapper.find('.at-filter-builder__select').setValue('shipped')

    // 根组下添加嵌套组
    await addGroup(wrapper)

    // 嵌套组条件 1：金额 > 100
    await addCondition(wrapper, 1)
    await setField(wrapper, '订单金额', 1)
    await operatorSelects(wrapper)[1].setValue('gt')
    await wrapper.find('.at-filter-builder__input').setValue('100')

    // 嵌套组条件 2：加急 = 是
    await addCondition(wrapper, 1)
    await setField(wrapper, '是否加急', 2)
    await wrapper.findAll('.at-filter-builder__select')[1].setValue('true')

    // 嵌套组逻辑改为 OR
    await wrapper.findAll('.at-filter-builder__logic')[1].setValue('or')

    const payload = lastEmit(wrapper)
    const expected: FilterGroup = {
      type: 'group',
      logic: 'and',
      children: [
        { type: 'condition', key: 'status', operator: 'eq', value: 'shipped' },
        {
          type: 'group',
          logic: 'or',
          children: [
            { type: 'condition', key: 'amount', operator: 'gt', value: 100 },
            { type: 'condition', key: 'urgent', operator: 'eq', value: true },
          ],
        },
      ],
    }

    expect(payload).toEqual(expected)
    expect(JSON.stringify(payload)).toBe(JSON.stringify(expected))

    // 验收要求原样贴出的 JSON（无函数、无 undefined）
    console.log(`FILTER_DEMO_JSON=${JSON.stringify(payload)}`)
  })
})
