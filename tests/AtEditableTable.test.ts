import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'

import AtEditableTable from '../src/components/AtEditableTable/AtEditableTable.vue'

import type { FieldDef } from '../src/types/schema'
import type { AtEditableTableChange, AtEditableTableError } from '../src/components/AtEditableTable/types'
import { isEditable } from '../src/utils/schema'

const fields: FieldDef[] = [
  {
    key: 'name',
    label: '姓名',
    type: 'text',
    rules: [{ required: true, message: '姓名不能为空' }],
  },
  { key: 'age', label: '年龄', type: 'number' },
  {
    key: 'role',
    label: '角色',
    type: 'select',
    options: [
      { label: '开发', value: 'dev' },
      { label: '产品', value: 'pm' },
    ],
  },
  { key: 'active', label: '启用', type: 'boolean' },
  { key: 'joinedAt', label: '入职日期', type: 'date' },
  { key: 'locked', label: '锁定', type: 'text', editable: false },
  {
    key: 'actions',
    label: '操作',
    type: 'custom',
    render: () => h('span', '查看'),
  },
]

function rows() {
  return [
    {
      id: 1,
      name: '张三',
      age: 20,
      role: 'dev',
      active: true,
      joinedAt: '2026-01-01',
      locked: 'x',
    },
    {
      id: 2,
      name: '李四',
      age: 30,
      role: 'pm',
      active: true,
      joinedAt: '2025-01-01',
      locked: 'y',
    },
  ]
}

function mountTable(props: Record<string, unknown> = {}) {
  return mount(AtEditableTable, {
    props: { fields, data: rows(), ...props },
  })
}

function rowAt(wrapper: ReturnType<typeof mountTable>, index: number) {
  return wrapper.findAll('tbody tr')[index]
}

function cellAt(wrapper: ReturnType<typeof mountTable>, rowIndex: number, cellIndex: number) {
  return rowAt(wrapper, rowIndex).findAll('td')[cellIndex]
}

function controlAt(wrapper: ReturnType<typeof mountTable>, rowIndex: number, key: string) {
  return rowAt(wrapper, rowIndex).find(`[data-key="${key}"]`)
}

function saveButton(wrapper: ReturnType<typeof mountTable>) {
  return wrapper.findAll('button').find((button) => button.text().includes('保存'))
}

describe('AtEditableTable 编辑控件', () => {
  it('渲染可编辑控件：text → input', () => {
    const wrapper = mountTable()

    const control = controlAt(wrapper, 0, 'name')
    expect(control.element.tagName).toBe('INPUT')
    expect(control.attributes('type')).toBe('text')
  })

  it('编辑与保存都不修改 props.data', async () => {
    const data = rows()
    const snapshot = JSON.parse(JSON.stringify(data))
    const wrapper = mountTable({ data })

    await controlAt(wrapper, 0, 'name').setValue('王五')
    await saveButton(wrapper)!.trigger('click')
    await flushPromises()

    expect(data).toEqual(snapshot)
  })

  it('Boolean / select / date 渲染对应控件', () => {
    const wrapper = mountTable()

    expect(controlAt(wrapper, 0, 'age').attributes('type')).toBe('number')
    expect(controlAt(wrapper, 0, 'role').element.tagName).toBe('SELECT')
    expect(controlAt(wrapper, 0, 'active').element.tagName).toBe('SELECT')
    expect(controlAt(wrapper, 0, 'joinedAt').attributes('type')).toBe('date')
  })

  it('custom 字段与 editable:false 字段不渲染编辑控件', () => {
    const wrapper = mountTable()

    expect(cellAt(wrapper, 0, 5).find('input').exists()).toBe(false)
    expect(cellAt(wrapper, 0, 5).text()).toBe('x')

    expect(cellAt(wrapper, 0, 6).find('input').exists()).toBe(false)
    expect(cellAt(wrapper, 0, 6).text()).toBe('查看')
  })

  it('全局 editable=false 时全部只读', () => {
    const wrapper = mountTable({ editable: false })

    expect(wrapper.findAll('tbody input')).toHaveLength(0)
    expect(wrapper.findAll('tbody select')).toHaveLength(0)
    expect(saveButton(wrapper)!.attributes('disabled')).toBeDefined()
  })
})

describe('AtEditableTable 草稿与脏状态', () => {
  it('改值后该行进入 dirty 并派发 dirty-change', async () => {
    const wrapper = mountTable()

    await controlAt(wrapper, 0, 'name').setValue('王五')

    expect(rowAt(wrapper, 0).classes()).toContain('at-editable-table__row--dirty')
    expect(wrapper.emitted('dirty-change')?.at(-1)?.[0]).toEqual([1])
  })

  it('改回原值后 dirty 消失', async () => {
    const wrapper = mountTable()

    await controlAt(wrapper, 0, 'name').setValue('王五')
    await controlAt(wrapper, 0, 'name').setValue('张三')

    expect(rowAt(wrapper, 0).classes()).not.toContain('at-editable-table__row--dirty')
    expect(wrapper.emitted('dirty-change')?.at(-1)?.[0]).toEqual([])
  })

  it('Esc 恢复当前单元格原值', async () => {
    const wrapper = mountTable()

    const control = controlAt(wrapper, 0, 'name')
    await control.setValue('王五')
    await control.trigger('keydown', { key: 'Escape' })

    expect((control.element as HTMLInputElement).value).toBe('张三')
    expect(rowAt(wrapper, 0).classes()).not.toContain('at-editable-table__row--dirty')
  })

  it('父组件更新 data 后，与新区值一致的草稿自动清除脏标记', async () => {
    const data = rows()
    const wrapper = mountTable({ data })

    await controlAt(wrapper, 0, 'name').setValue('王五')
    expect(rowAt(wrapper, 0).classes()).toContain('at-editable-table__row--dirty')

    const next = rows()
    next[0].name = '王五'
    await wrapper.setProps({ data: next })

    expect(rowAt(wrapper, 0).classes()).not.toContain('at-editable-table__row--dirty')
    expect((controlAt(wrapper, 0, 'name').element as HTMLInputElement).value).toBe('王五')
  })

  it('排序/翻页后草稿仍按 rowKey 绑定，不串行', async () => {
    const data = rows().reverse()
    const wrapper = mountTable({ data })

    await controlAt(wrapper, 1, 'name').setValue('王五')

    await wrapper.setProps({ data: rows() })

    expect((controlAt(wrapper, 0, 'name').element as HTMLInputElement).value).toBe('王五')
    expect((controlAt(wrapper, 1, 'name').element as HTMLInputElement).value).toBe('李四')
    expect(rowAt(wrapper, 0).classes()).toContain('at-editable-table__row--dirty')
    expect(rowAt(wrapper, 1).classes()).not.toContain('at-editable-table__row--dirty')
  })
})

describe('AtEditableTable 保存与校验', () => {
  it('校验通过时 emit 一次 save，changes 包含脏行', async () => {
    const wrapper = mountTable()

    await controlAt(wrapper, 0, 'name').setValue('王五')
    await saveButton(wrapper)!.trigger('click')
    await flushPromises()

    const saves = wrapper.emitted('save')
    expect(saves).toHaveLength(1)

    const changes = (saves![0][0] as { changes: AtEditableTableChange[] }).changes
    expect(changes).toHaveLength(1)
    expect(changes[0].key).toBe(1)
    expect(changes[0].patch).toEqual({ name: '王五' })
    expect(changes[0].row?.name).toBe('张三')
  })

  it('多行编辑时一次 save 的 changes 长度等于脏行数', async () => {
    const wrapper = mountTable()

    await controlAt(wrapper, 0, 'name').setValue('王五')
    await controlAt(wrapper, 1, 'age').setValue('40')
    await saveButton(wrapper)!.trigger('click')
    await flushPromises()

    const changes = (wrapper.emitted('save')![0][0] as { changes: AtEditableTableChange[] })
      .changes
    expect(changes).toHaveLength(2)
    expect(changes.map((change) => change.key)).toEqual([1, 2])
    expect(changes[1].patch.age).toBe(40)
  })

  it('required 校验失败阻止 save，emit validate-fail 并标红', async () => {
    const wrapper = mountTable()

    await controlAt(wrapper, 0, 'name').setValue('')
    await saveButton(wrapper)!.trigger('click')
    await flushPromises()

    expect(wrapper.emitted('save')).toBeUndefined()

    const errors = wrapper.emitted('validate-fail')![0][0] as AtEditableTableError[]
    expect(errors).toHaveLength(1)
    expect(errors[0].key).toBe(1)
    expect(errors[0].field.key).toBe('name')
    expect(errors[0].message).toBe('姓名不能为空')

    expect(rowAt(wrapper, 0).classes()).toContain('at-editable-table__row--invalid')
    expect(controlAt(wrapper, 0, 'name').classes()).toContain(
      'at-editable-table__control--invalid',
    )
    expect(cellAt(wrapper, 0, 0).find('.at-editable-table__error').text()).toBe('姓名不能为空')
  })

  it('异步 validator 返回错误消息时阻止 save 并 emit validate-fail', async () => {
    const asyncFields: FieldDef[] = [
      {
        key: 'name',
        label: '姓名',
        type: 'text',
        rules: [{ validator: async () => '名称已存在' }],
      },
    ]
    const wrapper = mountTable({ fields: asyncFields })

    await controlAt(wrapper, 0, 'name').setValue('王五')
    await saveButton(wrapper)!.trigger('click')
    await flushPromises()

    expect(wrapper.emitted('save')).toBeUndefined()

    const errors = wrapper.emitted('validate-fail')![0][0] as AtEditableTableError[]
    expect(errors).toHaveLength(1)
    expect(errors[0].key).toBe(1)
    expect(errors[0].message).toBe('名称已存在')
  })

  it('异步 validator 返回 true 时正常 emit save', async () => {
    const asyncFields: FieldDef[] = [
      {
        key: 'name',
        label: '姓名',
        type: 'text',
        rules: [{ validator: async (): Promise<true> => true }],
      },
    ]
    const wrapper = mountTable({ fields: asyncFields })

    await controlAt(wrapper, 0, 'name').setValue('王五')
    await saveButton(wrapper)!.trigger('click')
    await flushPromises()

    expect(wrapper.emitted('validate-fail')).toBeUndefined()
    const changes = (wrapper.emitted('save')![0][0] as { changes: AtEditableTableChange[] })
      .changes
    expect(changes).toHaveLength(1)
    expect(changes[0].patch).toEqual({ name: '王五' })
  })

  it('草稿行不在当前 data 时，save 仍 emit 且该行 row 为 undefined', async () => {
    const wrapper = mountTable()

    await controlAt(wrapper, 1, 'name').setValue('王五')
    await wrapper.setProps({ data: [rows()[0]] })
    await saveButton(wrapper)!.trigger('click')
    await flushPromises()

    const changes = (wrapper.emitted('save')![0][0] as { changes: AtEditableTableChange[] })
      .changes
    expect(changes).toHaveLength(1)
    expect(changes[0].key).toBe(2)
    expect(changes[0].patch).toEqual({ name: '王五' })
    expect(changes[0].row).toBeUndefined()
  })

  it('保存按钮的计数包含不在当前 data 中的跨页脏行', async () => {
    const wrapper = mountTable()

    await controlAt(wrapper, 0, 'name').setValue('王五')
    await controlAt(wrapper, 1, 'name').setValue('赵六')
    await wrapper.setProps({ data: [rows()[0]] })

    expect(saveButton(wrapper)!.text()).toContain('保存 2 项修改')
  })

  it('行级撤销恢复原值并 emit cancel', async () => {
    const wrapper = mountTable()

    await controlAt(wrapper, 0, 'name').setValue('王五')

    const cancel = wrapper
      .findAll('button')
      .find((button) => button.text() === '撤销')
    await cancel!.trigger('click')

    expect((controlAt(wrapper, 0, 'name').element as HTMLInputElement).value).toBe('张三')
    expect(rowAt(wrapper, 0).classes()).not.toContain('at-editable-table__row--dirty')
    expect(wrapper.emitted('cancel')![0][0]).toEqual({ keys: [1] })
  })

  it('saving=true 时输入与保存按钮全部禁用', () => {
    const wrapper = mountTable({ saving: true })

    expect(controlAt(wrapper, 0, 'name').attributes('disabled')).toBeDefined()
    expect(controlAt(wrapper, 0, 'role').attributes('disabled')).toBeDefined()
    expect(saveButton(wrapper)!.attributes('disabled')).toBeDefined()
  })
})

describe('isEditable 纯函数', () => {
  it('custom 恒 false、默认 true、显式 false 生效', () => {
    expect(
      isEditable({ key: 'a', label: 'A', type: 'custom', render: () => h('span') }),
    ).toBe(false)
    expect(isEditable({ key: 'b', label: 'B', type: 'text' })).toBe(true)
    expect(isEditable({ key: 'c', label: 'C', type: 'text', editable: false })).toBe(false)
  })
})
