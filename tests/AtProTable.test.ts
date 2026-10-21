import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AtProTable from '../src/components/AtProTable/AtProTable.vue'

import type { FieldDef } from '../src/types/schema'
import { orderFields } from './fixtures/order-fields'

const rows: Record<string, unknown>[] = [
  {
    id: 1,
    orderNo: 'AT20261021001',
    createdAt: '2026-10-21 10:00',
    customerName: '张三',
    itemCount: 3,
    amount: 1299.5,
    paymentMethod: 'wechat',
    status: 'shipped',
    urgent: true,
    remark: '尽快发货',
  },
  {
    id: 2,
    orderNo: 'AT20261021002',
    createdAt: '2026-10-21 11:00',
    customerName: '李四',
    itemCount: 1,
    amount: 99,
    paymentMethod: 'alipay',
    status: 'pending',
    urgent: false,
    remark: '',
  },
]

function mountTable(props: Record<string, unknown> = {}) {
  return mount(AtProTable, {
    props: { fields: orderFields, data: rows, rowKey: 'id', ...props },
  })
}

describe('AtProTable 基础渲染', () => {
  it('渲染列头与单元格', () => {
    const wrapper = mountTable()

    const headers = wrapper.findAll('th')
    expect(headers).toHaveLength(orderFields.length)
    expect(headers[0].text()).toContain('订单号')

    const firstRow = wrapper.findAll('tbody tr.at-pro-table__row')[0]
    expect(firstRow.text()).toContain('AT20261021001')
    expect(firstRow.text()).toContain('张三')
    // 枚举按 label 展示
    expect(firstRow.text()).toContain('已发货')
    // 布尔按 trueText 展示
    expect(firstRow.text()).toContain('加急')
  })

  it('formatter 生效', () => {
    const fields: FieldDef[] = [
      {
        key: 'amount',
        label: '金额',
        type: 'number',
        column: { formatter: (value) => `¥${String(value)}` },
      },
    ]
    const wrapper = mount(AtProTable, { props: { fields, data: [{ amount: 99 }] } })

    expect(wrapper.find('tbody td').text()).toBe('¥99')
  })

  it('空数据时显示空态文案', () => {
    const wrapper = mountTable({ data: [] })

    expect(wrapper.find('.at-pro-table__empty').text()).toBe('暂无数据')
  })

  it('loading 时显示 3 行骨架且不显示空态', () => {
    const wrapper = mountTable({ data: [], loading: true })

    expect(wrapper.findAll('tr.at-pro-table__skeleton-row')).toHaveLength(3)
    expect(wrapper.find('.at-pro-table__empty').exists()).toBe(false)
    expect(wrapper.find('thead').exists()).toBe(true)
  })
})

describe('AtProTable 分页', () => {
  it('点击页码 emit update:page', async () => {
    const wrapper = mountTable({ total: 50, page: 1, pageSize: 10 })

    const pageTwo = wrapper.findAll('button').find((button) => button.text() === '2')
    expect(pageTwo).toBeDefined()
    await pageTwo!.trigger('click')

    expect(wrapper.emitted('update:page')).toEqual([[2]])
  })

  it('切换每页条数同时 emit update:pageSize 与 update:page(1)', async () => {
    const wrapper = mountTable({ total: 50, page: 3, pageSize: 10 })

    await wrapper.find('.at-pro-pager__select').setValue('20')

    expect(wrapper.emitted('update:pageSize')).toEqual([[20]])
    expect(wrapper.emitted('update:page')).toEqual([[1]])
  })
})

describe('AtProTable 排序', () => {
  it('表头点击按 asc → desc → null 三态循环', async () => {
    const wrapper = mountTable()

    const amountTh = () =>
      wrapper.findAll('th').find((th) => th.text().includes('订单金额'))!

    await amountTh().trigger('click')
    expect(wrapper.emitted('update:sort')?.[0]).toEqual([{ key: 'amount', order: 'asc' }])

    await wrapper.setProps({ sortKey: 'amount', sortOrder: 'asc' })
    await amountTh().trigger('click')
    expect(wrapper.emitted('update:sort')?.[1]).toEqual([{ key: 'amount', order: 'desc' }])

    await wrapper.setProps({ sortKey: 'amount', sortOrder: 'desc' })
    await amountTh().trigger('click')
    expect(wrapper.emitted('update:sort')?.[2]).toEqual([{ key: 'amount', order: null }])
  })

  it('th 带 scope="col"，排序时 aria-sort 正确', async () => {
    const wrapper = mountTable()

    wrapper.findAll('th').forEach((th) => {
      expect(th.attributes('scope')).toBe('col')
    })

    await wrapper.setProps({ sortKey: 'amount', sortOrder: 'asc' })
    const amountTh = wrapper.findAll('th').find((th) => th.text().includes('订单金额'))!
    expect(amountTh.attributes('aria-sort')).toBe('ascending')

    await wrapper.setProps({ sortOrder: 'desc' })
    expect(amountTh.attributes('aria-sort')).toBe('descending')

    await wrapper.setProps({ sortKey: undefined, sortOrder: null })
    const plainTh = wrapper.findAll('th').find((th) => th.text().includes('客户名'))!
    expect(plainTh.attributes('aria-sort')).toBeUndefined()
  })

  it('可排序表头支持 Enter 触发排序，非排序表头不可聚焦', async () => {
    const wrapper = mountTable()

    const amountTh = wrapper.findAll('th').find((th) => th.text().includes('订单金额'))!
    const plainTh = wrapper.findAll('th').find((th) => th.text().includes('客户名'))!

    expect(amountTh.attributes('tabindex')).toBe('0')
    expect(plainTh.attributes('tabindex')).toBeUndefined()

    await amountTh.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('update:sort')).toHaveLength(1)
    expect(wrapper.emitted('update:sort')?.[0]).toEqual([{ key: 'amount', order: 'asc' }])
  })

  it('可排序表头支持 Space 触发排序，顺序与点击一致', async () => {
    const wrapper = mountTable({ sortKey: 'amount', sortOrder: 'asc' })

    const amountTh = wrapper.findAll('th').find((th) => th.text().includes('订单金额'))!
    await amountTh.trigger('keydown', { key: ' ' })

    expect(wrapper.emitted('update:sort')).toHaveLength(1)
    expect(wrapper.emitted('update:sort')?.[0]).toEqual([{ key: 'amount', order: 'desc' }])
  })
})

describe('AtProTable 选择', () => {
  it('勾选行 emit update:selectedKeys', async () => {
    const wrapper = mountTable({ selectable: true })

    const rowCheckbox = wrapper.find('tbody input[type="checkbox"]')
    await rowCheckbox.setValue(true)

    expect(wrapper.emitted('update:selectedKeys')).toEqual([[[1]]])
  })
})

describe('AtProTable 列设置与交互', () => {
  it('取消勾选后该列 th 与 td 都不渲染', async () => {
    const wrapper = mountTable()

    const remarkItem = wrapper
      .findAll('label.at-pro-table__settings-item')
      .find((label) => label.text() === '备注')!
    await remarkItem.find('input[type="checkbox"]').setValue(false)

    expect(
      wrapper.findAll('th').some((th) => th.text().includes('备注')),
    ).toBe(false)
    expect(wrapper.findAll('th')).toHaveLength(orderFields.length - 1)
    expect(wrapper.findAll('tbody tr.at-pro-table__row')[0].findAll('td')).toHaveLength(
      orderFields.length - 1,
    )
  })

  it('cell-{key} 插槽能拿到 row 与 value', () => {
    const wrapper = mount(AtProTable, {
      props: { fields: orderFields, data: rows, rowKey: 'id' },
      slots: {
        'cell-customerName': ({ row, value }: { row: Record<string, unknown>; value: unknown }) =>
          `客户=${String(value)}/${String(row.orderNo)}`,
      },
    })

    expect(wrapper.find('tbody tr.at-pro-table__row').text()).toContain(
      '客户=张三/AT20261021001',
    )
  })

  it('点击行 emit row-click', async () => {
    const wrapper = mountTable()

    await wrapper.find('tbody tr.at-pro-table__row').trigger('click')

    expect(wrapper.emitted('row-click')?.[0]).toEqual([rows[0]])
  })

  it('ellipsis 列在单元格上带 title 全文', () => {
    const fields: FieldDef[] = [
      { key: 'remark', label: '备注', type: 'text', column: { ellipsis: true } },
    ]
    const wrapper = mount(AtProTable, {
      props: { fields, data: [{ remark: '一段很长的备注内容' }] },
    })

    expect(wrapper.find('.at-pro-table__cell-text').attributes('title')).toBe(
      '一段很长的备注内容',
    )
  })
})
