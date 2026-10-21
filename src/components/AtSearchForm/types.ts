import type { FieldDef, SearchOperator } from '../../types/schema'

export interface AtSearchFormProps {
  fields: FieldDef[]
  modelValue?: Record<string, unknown>
  columns?: number
  collapsible?: boolean
  loading?: boolean
}

/** 由字段协议推导出的查询条件，operator 仅使用已冻结的 SearchOperator */
export type SearchCondition = {
  key: string
  operator: SearchOperator
  value: unknown
}

export interface AtSearchFormSearchPayload {
  values: Record<string, unknown>
  conditions: SearchCondition[]
}
