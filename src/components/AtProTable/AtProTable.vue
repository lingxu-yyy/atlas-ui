<script setup lang="ts">
import { computed, defineComponent, ref, type CSSProperties, type PropType } from 'vue'

import { toColumnSchema } from '../../utils/schema'
import type { ColumnSchema, CustomField, FieldDef } from '../../types/schema'

import AtProPager from './AtProPager.vue'
import type { AtProTableProps, SortOrder } from './types'

defineOptions({
  name: 'AtProTable',
})

const props = withDefaults(defineProps<AtProTableProps>(), {
  rowKey: 'id',
  loading: false,
  page: 1,
  pageSize: 10,
  pageSizes: () => [10, 20, 50, 100],
  selectable: false,
  selectedKeys: () => [],
  sortOrder: null,
  emptyText: '暂无数据',
  striped: false,
  bordered: false,
})

const emit = defineEmits<{
  'update:page': [page: number]
  'update:pageSize': [size: number]
  'update:sort': [payload: { key: string; order: SortOrder }]
  'update:selectedKeys': [keys: (string | number)[]]
  'row-click': [row: Record<string, unknown>]
}>()

interface RenderColumn {
  field: FieldDef
  column: ColumnSchema
}

/** 列只能由字段协议推导，组件内不重复实现列推导逻辑 */
const allColumns = computed<RenderColumn[]>(() =>
  props.fields.map((field) => ({ field, column: toColumnSchema(field) })),
)

const hiddenKeys = ref<string[]>([])

const visibleColumns = computed<RenderColumn[]>(() =>
  allColumns.value.filter((item) => !hiddenKeys.value.includes(item.column.key)),
)

const colspan = computed(() => visibleColumns.value.length + (props.selectable ? 1 : 0))

const totalCount = computed(() => props.total ?? props.data.length)

/** 自定义渲染单元：把字段的 render 包成组件，避免在模板里直接输出 VNode */
const CustomCell = defineComponent({
  name: 'AtProTableCustomCell',
  props: {
    field: { type: Object as PropType<CustomField>, required: true },
    row: { type: Object as PropType<Record<string, unknown>>, required: true },
  },
  setup(cellProps) {
    return () => cellProps.field.render(cellProps.row[cellProps.field.key], cellProps.row)
  },
})

function asCustom(field: FieldDef): CustomField {
  return field as CustomField
}

/* ---------- 列显隐 ---------- */

function toggleColumn(key: string, event: Event) {
  const checked = (event.target as HTMLInputElement).checked
  hiddenKeys.value = checked
    ? hiddenKeys.value.filter((item) => item !== key)
    : [...hiddenKeys.value, key]
}

/* ---------- 单元格取值 ---------- */

function labelOf(field: CustomField | FieldDef, value: unknown): string {
  const options = 'options' in field ? (field.options ?? []) : []
  const matched = options.find((option) => option.value === value)
  return matched ? matched.label : value === undefined || value === null ? '' : String(value)
}

function formatCell(item: RenderColumn, row: Record<string, unknown>): string {
  const value = row[item.column.key]
  if (item.column.formatter) return item.column.formatter(value, row)

  const field = item.field
  switch (field.type) {
    case 'boolean':
      return value ? (field.trueText ?? '是') : (field.falseText ?? '否')
    case 'select': {
      if (field.multiple && Array.isArray(value)) {
        return value.map((entry) => labelOf(field, entry)).join('、')
      }
      return labelOf(field, value)
    }
    case 'number': {
      if (value === undefined || value === null || value === '') return ''
      const text =
        field.precision === undefined ? String(value) : Number(value).toFixed(field.precision)
      return field.unit ? `${text} ${field.unit}` : text
    }
    case 'custom':
      return ''
    default:
      return value === undefined || value === null ? '' : String(value)
  }
}

function cellStyle(item: RenderColumn): CSSProperties {
  return {
    width: item.column.width === undefined ? undefined : `${item.column.width}px`,
    textAlign: item.column.align,
  }
}

/* ---------- 排序 ---------- */

function orderOf(key: string): SortOrder {
  return props.sortKey === key ? (props.sortOrder ?? null) : null
}

function nextOrder(current: SortOrder): SortOrder {
  if (current === null) return 'asc'
  if (current === 'asc') return 'desc'
  return null
}

function ariaSort(item: RenderColumn): 'ascending' | 'descending' | 'none' | undefined {
  if (!item.column.sortable) return undefined
  const order = orderOf(item.column.key)
  if (order === 'asc') return 'ascending'
  if (order === 'desc') return 'descending'
  return 'none'
}

function sortIcon(key: string): string {
  const order = orderOf(key)
  if (order === 'asc') return '↑'
  if (order === 'desc') return '↓'
  return '↕'
}

function onHeaderClick(item: RenderColumn) {
  if (!item.column.sortable) return
  emit('update:sort', { key: item.column.key, order: nextOrder(orderOf(item.column.key)) })
}

/* ---------- 选择 ---------- */

function getRowKey(row: Record<string, unknown>): string | number {
  const value = row[props.rowKey]
  if (typeof value === 'string' || typeof value === 'number') return value
  return String(props.data.indexOf(row))
}

function isSelected(row: Record<string, unknown>): boolean {
  return props.selectedKeys.includes(getRowKey(row))
}

const allChecked = computed(
  () => props.data.length > 0 && props.data.every((row) => isSelected(row)),
)

const someChecked = computed(
  () => props.data.some((row) => isSelected(row)) && !allChecked.value,
)

function toggleAll(event: Event) {
  const checked = (event.target as HTMLInputElement).checked
  const next = new Set(props.selectedKeys)
  props.data.forEach((row) => {
    const key = getRowKey(row)
    if (checked) next.add(key)
    else next.delete(key)
  })
  emit('update:selectedKeys', [...next])
}

function toggleRow(row: Record<string, unknown>, event: Event) {
  const checked = (event.target as HTMLInputElement).checked
  const key = getRowKey(row)
  const next = new Set(props.selectedKeys)
  if (checked) next.add(key)
  else next.delete(key)
  emit('update:selectedKeys', [...next])
}

/* ---------- 分页 ---------- */

function onPageSizeChange(size: number) {
  emit('update:pageSize', size)
  emit('update:page', 1)
}
</script>

<template>
  <div
    class="at-pro-table"
    :class="{
      'at-pro-table--bordered': bordered,
      'at-pro-table--striped': striped,
    }"
  >
    <div class="at-pro-table__top">
      <div class="at-pro-table__toolbar">
        <slot name="toolbar" />
      </div>

      <details class="at-pro-table__settings">
        <summary class="at-pro-table__settings-summary">列设置</summary>
        <div class="at-pro-table__settings-panel">
          <label
            v-for="field in fields"
            :key="field.key"
            class="at-pro-table__settings-item"
          >
            <input
              type="checkbox"
              class="at-pro-table__column-toggle"
              :checked="!hiddenKeys.includes(field.key)"
              @change="toggleColumn(field.key, $event)"
            />
            <span>{{ field.label }}</span>
          </label>
        </div>
      </details>
    </div>

    <div class="at-pro-table__scroll">
      <table class="at-pro-table__table">
        <thead>
          <tr>
            <th v-if="selectable" scope="col" class="at-pro-table__check-cell">
              <input
                type="checkbox"
                :checked="allChecked"
                :indeterminate.prop="someChecked"
                aria-label="全选当前页"
                @change="toggleAll"
              />
            </th>
            <th
              v-for="item in visibleColumns"
              :key="item.column.key"
              scope="col"
              class="at-pro-table__th"
              :class="{ 'at-pro-table__th--sortable': item.column.sortable }"
              :style="cellStyle(item)"
              :aria-sort="ariaSort(item)"
              :tabindex="item.column.sortable ? 0 : undefined"
              @click="onHeaderClick(item)"
              @keydown.enter="onHeaderClick(item)"
              @keydown.space.prevent="onHeaderClick(item)"
            >
              <span class="at-pro-table__th-content">
                <slot :name="`header-${item.column.key}`" :field="item.field">
                  <span class="at-pro-table__th-text">{{ item.column.title }}</span>
                </slot>
                <span v-if="item.column.sortable" class="at-pro-table__sort" aria-hidden="true">
                  {{ sortIcon(item.column.key) }}
                </span>
              </span>
            </th>
          </tr>
        </thead>

        <tbody>
          <template v-if="loading">
            <tr
              v-for="index in 3"
              :key="`skeleton-${index}`"
              class="at-pro-table__skeleton-row"
            >
              <td :colspan="colspan" class="at-pro-table__td">
                <span class="at-pro-table__skeleton-bar" />
              </td>
            </tr>
          </template>

          <template v-else>
            <tr v-if="data.length === 0">
              <td :colspan="colspan" class="at-pro-table__empty">
                <slot name="empty">{{ emptyText }}</slot>
              </td>
            </tr>

            <tr
              v-for="(row, index) in data"
              :key="getRowKey(row)"
              class="at-pro-table__row"
              @click="emit('row-click', row)"
            >
              <td v-if="selectable" class="at-pro-table__check-cell" @click.stop>
                <input
                  type="checkbox"
                  :checked="isSelected(row)"
                  aria-label="选择行"
                  @change="toggleRow(row, $event)"
                />
              </td>

              <td
                v-for="item in visibleColumns"
                :key="item.column.key"
                class="at-pro-table__td"
                :class="{ 'at-pro-table__td--ellipsis': item.column.ellipsis }"
                :style="cellStyle(item)"
              >
                <slot
                  :name="`cell-${item.column.key}`"
                  :row="row"
                  :value="row[item.column.key]"
                  :index="index"
                >
                  <CustomCell
                    v-if="item.field.type === 'custom'"
                    :field="asCustom(item.field)"
                    :row="row"
                  />
                  <span
                    v-else
                    class="at-pro-table__cell-text"
                    :class="{ 'at-pro-table__cell-text--ellipsis': item.column.ellipsis }"
                    :title="item.column.ellipsis ? formatCell(item, row) : undefined"
                  >
                    {{ formatCell(item, row) }}
                  </span>
                </slot>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <AtProPager
      v-if="totalCount > 0"
      :page="page"
      :page-size="pageSize"
      :total="totalCount"
      :page-sizes="pageSizes"
      @update:page="(value: number) => emit('update:page', value)"
      @update:pageSize="onPageSizeChange"
    />
  </div>
</template>

<style>
.at-pro-table {
  width: 100%;
  border: 1px solid var(--at-color-border);
  border-radius: var(--at-radius-md);
  background-color: var(--at-color-bg);
  color: var(--at-color-text-1);
  font-size: var(--at-font-base);
  line-height: var(--at-line-height);
  overflow: hidden;
}

.at-pro-table__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--at-space-md);
  padding: var(--at-space-sm) var(--at-space-md);
  border-bottom: 1px solid var(--at-color-border);
}

.at-pro-table__toolbar {
  flex: 1;
  min-width: 0;
  font-size: var(--at-font-sm);
  color: var(--at-color-text-2);
}

.at-pro-table__toolbar:empty {
  display: none;
}

/* 列设置：原生 details，不做浮层定位 */
.at-pro-table__settings {
  flex: none;
  position: relative;
  font-size: var(--at-font-sm);
  color: var(--at-color-text-2);
}

.at-pro-table__settings-summary {
  cursor: pointer;
  user-select: none;
  list-style: none;
  padding: var(--at-space-xs) var(--at-space-sm);
  border: 1px solid var(--at-color-border);
  border-radius: var(--at-radius-sm);
  background-color: var(--at-color-bg);
}

.at-pro-table__settings-summary::-webkit-details-marker {
  display: none;
}

.at-pro-table__settings-summary:hover {
  background-color: var(--at-color-fill-hover);
}

.at-pro-table__settings[open] .at-pro-table__settings-summary {
  border-color: var(--at-color-primary);
  color: var(--at-color-primary);
}

.at-pro-table__settings-panel {
  position: absolute;
  right: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: var(--at-space-xs);
  margin-top: var(--at-space-xs);
  padding: var(--at-space-sm);
  border: 1px solid var(--at-color-border);
  border-radius: var(--at-radius-sm);
  background-color: var(--at-color-bg);
  box-shadow: var(--at-shadow-sm);
}

.at-pro-table__settings-item {
  display: inline-flex;
  align-items: center;
  gap: var(--at-space-xs);
  cursor: pointer;
  white-space: nowrap;
}

.at-pro-table__scroll {
  width: 100%;
  overflow-x: auto;
}

.at-pro-table__table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.at-pro-table__th {
  padding: var(--at-space-sm) var(--at-space-md);
  background-color: var(--at-color-bg-subtle);
  color: var(--at-color-text-2);
  font-weight: 500;
  text-align: left;
  border-bottom: 1px solid var(--at-color-border);
  white-space: nowrap;
}

.at-pro-table__th--sortable {
  cursor: pointer;
  user-select: none;
}

.at-pro-table__th--sortable:hover {
  color: var(--at-color-primary);
}

.at-pro-table__th--sortable:focus-visible {
  outline: 2px solid var(--at-color-primary);
  outline-offset: -2px;
}

.at-pro-table__th-content {
  display: inline-flex;
  align-items: center;
  gap: var(--at-space-xs);
}

.at-pro-table__sort {
  color: var(--at-color-text-3);
  font-size: var(--at-font-sm);
}

.at-pro-table__th--sortable:hover .at-pro-table__sort {
  color: var(--at-color-primary);
}

.at-pro-table__td {
  padding: var(--at-space-sm) var(--at-space-md);
  border-bottom: 1px solid var(--at-color-border);
  vertical-align: middle;
}

.at-pro-table__row:last-child .at-pro-table__td {
  border-bottom: none;
}

.at-pro-table__row {
  transition: background-color var(--at-duration-fast) var(--at-ease-out);
}

.at-pro-table__row:hover {
  background-color: var(--at-color-fill-hover);
}

.at-pro-table--striped .at-pro-table__row:nth-child(even) {
  background-color: var(--at-color-bg-subtle);
}

.at-pro-table--bordered .at-pro-table__td,
.at-pro-table--bordered .at-pro-table__th {
  border: 1px solid var(--at-color-border);
}

.at-pro-table__cell-text {
  display: block;
  overflow: hidden;
}

.at-pro-table__cell-text--ellipsis {
  text-overflow: ellipsis;
  white-space: nowrap;
}

.at-pro-table__td--ellipsis {
  overflow: hidden;
}

.at-pro-table__check-cell {
  width: var(--at-space-xl);
  padding: 0 var(--at-space-sm);
  text-align: center;
}

.at-pro-table__empty {
  padding: var(--at-space-xl) var(--at-space-md);
  color: var(--at-color-text-3);
  text-align: center;
}

.at-pro-table__skeleton-row .at-pro-table__td {
  padding: var(--at-space-sm) var(--at-space-md);
}

.at-pro-table__skeleton-bar {
  display: block;
  height: var(--at-space-md);
  border-radius: var(--at-radius-sm);
  background-color: var(--at-color-fill-hover);
  animation: at-pro-table-pulse 1.2s var(--at-ease-out) infinite;
}

@keyframes at-pro-table-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}
</style>
