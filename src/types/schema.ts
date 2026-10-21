import type { VNodeChild } from 'vue'

export type FieldType = 'text' | 'number' | 'select' | 'date' | 'boolean' | 'custom'

export interface FieldOption {
  label: string
  value: string | number
  disabled?: boolean
}

export interface FieldBase {
  /** 数据字段名 */
  key: string
  /** 展示标签，同时作为列标题 */
  label: string
  type: FieldType
  width?: number
  align?: 'left' | 'center' | 'right'
  hint?: string
  /** 是否可在 AtEditableTable 中编辑，默认 true；custom 类型恒为 false */
  editable?: boolean
}

export interface TextField extends FieldBase {
  type: 'text'
  maxLength?: number
}

export interface NumberField extends FieldBase {
  type: 'number'
  min?: number
  max?: number
  precision?: number
  unit?: string
}

export interface SelectField extends FieldBase {
  type: 'select'
  options?: FieldOption[]
  loadOptions?: () => Promise<FieldOption[]>
  multiple?: boolean
  filterable?: boolean
}

export interface DateField extends FieldBase {
  type: 'date'
  format?: string
  range?: boolean
}

export interface BooleanField extends FieldBase {
  type: 'boolean'
  trueText?: string
  falseText?: string
}

export interface CustomField extends FieldBase {
  type: 'custom'
  render: (value: unknown, row: Record<string, unknown>) => VNodeChild
}

export type FieldSchema =
  | TextField
  | NumberField
  | SelectField
  | DateField
  | BooleanField
  | CustomField

export type SearchOperator =
  | 'eq' | 'like' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'in'

export interface ColumnSchema {
  key: string
  title: string
  width?: number
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  fixed?: 'left' | 'right'
  ellipsis?: boolean
  formatter?: (value: unknown, row: Record<string, unknown>) => string
  /** 表头分组，有 children 时不渲染自身 */
  children?: ColumnSchema[]
}

export interface ValidationRule {
  required?: boolean
  min?: number
  max?: number
  pattern?: RegExp
  message?: string
  trigger?: 'input' | 'blur' | 'submit'
  validator?: (value: unknown) => true | string | Promise<true | string>
}

/**
 * 注意：FieldSchema 是联合类型，不能用 interface extends，
 * 必须用交叉类型。照抄下面这行，不要改成 interface。
 */
export type FieldDef = FieldSchema & {
  /** 是否出现在搜索区，默认 true */
  searchable?: boolean
  defaultValue?: unknown
  rules?: ValidationRule[]
  /** 表格列的额外配置，覆盖由字段推导出的默认值 */
  column?: Partial<
    Pick<ColumnSchema, 'width' | 'sortable' | 'fixed' | 'ellipsis' | 'formatter'>
  >
}

export interface RendererContext {
  value: unknown
  field: FieldSchema
  row?: Record<string, unknown>
  onChange?: (value: unknown) => void
}

export type FieldRenderer = (ctx: RendererContext) => VNodeChild
