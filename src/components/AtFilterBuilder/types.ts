import type { FieldDef, SearchOperator } from '../../types/schema'

/** 组内逻辑关系：and = 全部满足，or = 任一满足 */
export type Logic = 'and' | 'or'

/** 单个条件叶子 */
export interface FilterLeaf {
  type: 'condition'
  key: string
  operator: SearchOperator
  value: unknown
}

/** 条件组，children 可继续嵌套条件组 */
export interface FilterGroup {
  type: 'group'
  logic: Logic
  children: FilterNode[]
}

export type FilterNode = FilterLeaf | FilterGroup

export interface AtFilterBuilderProps {
  /** 与 AtProTable / AtSearchForm 共用的字段协议 */
  fields: FieldDef[]
  /** 条件树（受控） */
  modelValue?: FilterNode | null
  /** 最大嵌套层数，根组算第 1 层 */
  maxDepth?: number
  disabled?: boolean
}
