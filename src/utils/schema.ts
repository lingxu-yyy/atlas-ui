import type {
  ColumnSchema,
  FieldDef,
  FieldRenderer,
  FieldSchema,
} from '../types/schema'

/** 字段类型推导出的默认对齐方式：数字右对齐、布尔居中、其余左对齐 */
function defaultAlign(type: FieldSchema['type']): NonNullable<ColumnSchema['align']> {
  if (type === 'number') return 'right'
  if (type === 'boolean') return 'center'
  return 'left'
}

/** 由字段协议推导表格列：column 覆盖优先于字段本身的默认配置 */
export function toColumnSchema(field: FieldDef): ColumnSchema {
  const column: ColumnSchema = {
    key: field.key,
    title: field.label,
    align: field.align ?? defaultAlign(field.type),
  }

  const width = field.column?.width ?? field.width
  if (width !== undefined) column.width = width

  const extra = field.column
  if (extra?.sortable !== undefined) column.sortable = extra.sortable
  if (extra?.fixed !== undefined) column.fixed = extra.fixed
  if (extra?.ellipsis !== undefined) column.ellipsis = extra.ellipsis
  if (extra?.formatter !== undefined) column.formatter = extra.formatter

  return column
}

/** 字段的空值：用于新建表单、搜索区重置 */
export function getDefaultValue(field: FieldSchema): unknown {
  switch (field.type) {
    case 'text':
      return ''
    case 'number':
      return undefined
    case 'select':
      return field.multiple ? [] : undefined
    case 'date':
      return field.range ? [] : undefined
    case 'boolean':
      return false
    case 'custom':
      return undefined
  }
}

/** custom 字段不参与搜索；其余字段默认参与，可显式关闭 */
export function isSearchable(field: FieldDef): boolean {
  if (field.type === 'custom') return false
  return field.searchable ?? true
}

/** custom 字段不参与编辑；其余字段默认参与，可显式关闭 */
export function isEditable(field: FieldDef): boolean {
  if (field.type === 'custom') return false
  return field.editable ?? true
}

/**
 * 渲染器注册表：新增字段类型只能通过 register 扩展，
 * 组件内部不允许按 type 写 if/else 分支。
 */
export function createRendererRegistry(): {
  register(type: string, renderer: FieldRenderer): void
  get(type: string): FieldRenderer | undefined
  has(type: string): boolean
} {
  const registry = new Map<string, FieldRenderer>()

  return {
    register(type: string, renderer: FieldRenderer): void {
      registry.set(type, renderer)
    },
    get(type: string): FieldRenderer | undefined {
      return registry.get(type)
    },
    has(type: string): boolean {
      return registry.has(type)
    },
  }
}
