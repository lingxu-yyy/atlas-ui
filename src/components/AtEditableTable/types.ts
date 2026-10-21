import type { FieldDef } from '../../types/schema'

export type RowKey = string | number

export type RowState = 'pristine' | 'dirty' | 'invalid'

export interface AtEditableTableProps {
  fields: FieldDef[]
  data: Record<string, unknown>[]
  rowKey?: string
  editable?: boolean
  loading?: boolean
  saving?: boolean
}

/** 一次保存携带一行：key 为 rowKey，patch 为变更字段，row 为保存前的原值（当前 data 中不存在时为 undefined） */
export interface AtEditableTableChange {
  key: RowKey
  patch: Record<string, unknown>
  row?: Record<string, unknown>
}

export interface AtEditableTableError {
  key: RowKey
  field: FieldDef
  message: string
}
