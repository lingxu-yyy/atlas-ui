import { describe, expect, it } from 'vitest'

import type { FieldDef, FieldRenderer } from '../src/types/schema'
import {
  createRendererRegistry,
  getDefaultValue,
  isSearchable,
  toColumnSchema,
} from '../src/utils/schema'

import { orderFields } from './fixtures/order-fields'
import { productFields } from './fixtures/product-fields'
import { userFields } from './fixtures/user-fields'

describe('字段协议：联合类型收窄', () => {
  it('text 字段能取到 maxLength', () => {
    const field: FieldDef = { key: 'nickname', label: '昵称', type: 'text', maxLength: 20 }

    if (field.type !== 'text') throw new Error('类型收窄失败')

    expect(field.maxLength).toBe(20)
  })

  it('date 字段能取到 range', () => {
    const field: FieldDef = { key: 'createdAt', label: '创建时间', type: 'date', range: true }

    if (field.type !== 'date') throw new Error('类型收窄失败')

    expect(field.range).toBe(true)
  })
})

describe('toColumnSchema', () => {
  it('title 取 label，key 取字段名', () => {
    const column = toColumnSchema({ key: 'amount', label: '订单金额', type: 'number' })

    expect(column.title).toBe('订单金额')
    expect(column.key).toBe('amount')
  })

  it('默认对齐：text 左、number 右、boolean 居中', () => {
    expect(toColumnSchema({ key: 'a', label: 'A', type: 'text' }).align).toBe('left')
    expect(toColumnSchema({ key: 'b', label: 'B', type: 'number' }).align).toBe('right')
    expect(toColumnSchema({ key: 'c', label: 'C', type: 'boolean' }).align).toBe('center')
  })

  it('column 配置优先于字段自身配置', () => {
    const formatter = (value: unknown) => String(value)
    const column = toColumnSchema({
      key: 'amount',
      label: '订单金额',
      type: 'number',
      width: 100,
      column: { width: 200, sortable: true, fixed: 'right', ellipsis: true, formatter },
    })

    expect(column.width).toBe(200)
    expect(column.sortable).toBe(true)
    expect(column.fixed).toBe('right')
    expect(column.ellipsis).toBe(true)
    expect(column.formatter).toBe(formatter)
  })
})

describe('getDefaultValue', () => {
  it('text 为空串、boolean 为 false', () => {
    expect(getDefaultValue({ key: 'a', label: 'A', type: 'text' })).toBe('')
    expect(getDefaultValue({ key: 'b', label: 'B', type: 'boolean' })).toBe(false)
  })

  it('select multiple 为空数组', () => {
    const value = getDefaultValue({ key: 'tags', label: '标签', type: 'select', multiple: true })

    expect(value).toEqual([])
  })
})

describe('isSearchable', () => {
  it('custom 类型恒为 false', () => {
    const field: FieldDef = {
      key: 'actions',
      label: '操作',
      type: 'custom',
      searchable: true,
      render: () => 'ok',
    }

    expect(isSearchable(field)).toBe(false)
  })

  it('未声明 searchable 时默认为 true', () => {
    expect(isSearchable({ key: 'name', label: '商品名', type: 'text' })).toBe(true)
  })
})

describe('真实用例：字段数推导列数', () => {
  it('订单列表 10 字段 → 10 列', () => {
    const columns = orderFields.map(toColumnSchema)

    expect(orderFields).toHaveLength(10)
    expect(columns).toHaveLength(orderFields.length)
  })

  it('商品筛选 8 字段 → 8 列', () => {
    const columns = productFields.map(toColumnSchema)

    expect(productFields).toHaveLength(8)
    expect(columns).toHaveLength(productFields.length)
  })

  it('用户列表 8 字段 → 8 列', () => {
    const columns = userFields.map(toColumnSchema)

    expect(userFields).toHaveLength(8)
    expect(columns).toHaveLength(userFields.length)
  })
})

describe('createRendererRegistry', () => {
  const renderer: FieldRenderer = (ctx) => String(ctx.value)

  it('register 后可 get 且 has 为 true', () => {
    const registry = createRendererRegistry()

    registry.register('rating', renderer)

    expect(registry.get('rating')).toBe(renderer)
    expect(registry.has('rating')).toBe(true)
  })

  it('未注册的 type 返回 undefined', () => {
    const registry = createRendererRegistry()

    expect(registry.get('missing')).toBeUndefined()
    expect(registry.has('missing')).toBe(false)
  })
})
