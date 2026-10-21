import type { FieldDef } from '../../types/schema'

export interface AtProTableProps {
  fields: FieldDef[]
  data: Record<string, unknown>[]
  rowKey?: string
  loading?: boolean
  page?: number
  pageSize?: number
  total?: number
  pageSizes?: number[]
  selectable?: boolean
  selectedKeys?: (string | number)[]
  sortKey?: string
  sortOrder?: 'asc' | 'desc' | null
  emptyText?: string
  striped?: boolean
  bordered?: boolean
}

export type SortOrder = 'asc' | 'desc' | null

export interface AtProTableSortPayload {
  key: string
  order: SortOrder
}
