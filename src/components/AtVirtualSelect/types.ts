import type { FieldOption, SelectField } from '../../types/schema'

export interface AtVirtualSelectProps {
  /** 只接受 FieldDef 中 type 为 select 的字段 */
  field: SelectField
  modelValue?: unknown
  /** 未选择时的占位文案 */
  placeholder?: string
  disabled?: boolean
  /** 固定行高，虚拟滚动的前提 */
  itemHeight?: number
  /** 上下额外渲染的行数 */
  overscan?: number
  /** 列表可视区域能容纳的行数，决定浮层高度 */
  maxVisibleItems?: number
}

export interface AtVirtualSelectOptionSlot {
  option: FieldOption
  index: number
  selected: boolean
}
