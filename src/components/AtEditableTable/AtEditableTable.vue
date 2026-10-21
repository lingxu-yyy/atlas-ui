<script setup lang="ts">
import {
  computed,
  defineComponent,
  reactive,
  ref,
  watch,
  type CSSProperties,
  type PropType,
} from 'vue'

import { isEditable, toColumnSchema } from '../../utils/schema'
import type { ColumnSchema, CustomField, FieldDef } from '../../types/schema'

import type {
  AtEditableTableChange,
  AtEditableTableError,
  AtEditableTableProps,
  RowKey,
} from './types'

defineOptions({
  name: 'AtEditableTable',
})

const props = withDefaults(defineProps<AtEditableTableProps>(), {
  rowKey: 'id',
  editable: true,
  loading: false,
  saving: false,
})

const emit = defineEmits<{
  save: [payload: { changes: AtEditableTableChange[] }]
  cancel: [payload: { keys: RowKey[] }]
  'validate-fail': [errors: AtEditableTableError[]]
  'dirty-change': [keys: RowKey[]]
}>()

interface RenderColumn {
  field: FieldDef
  column: ColumnSchema
}

const columns = computed<RenderColumn[]>(() =>
  props.fields.map((field) => ({ field, column: toColumnSchema(field) })),
)

const colspan = computed(() => columns.value.length + 1)

/* ---------- 草稿：按 rowKey 存，不按下标 ---------- */

const drafts = reactive(new Map<RowKey, Record<string, unknown>>())
const validationErrors = ref<AtEditableTableError[]>([])
const validating = ref(false)

function rowKeyOf(row: Record<string, unknown>): RowKey {
  const value = row[props.rowKey]
  if (typeof value === 'string' || typeof value === 'number') return value
  return String(props.data.indexOf(row))
}

function sameValue(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => Object.is(item, right[index]))
  }
  return Object.is(left, right)
}

function valueOf(row: Record<string, unknown>, field: FieldDef): unknown {
  const draft = drafts.get(rowKeyOf(row))
  if (draft && field.key in draft) return draft[field.key]
  return row[field.key]
}

function isDirtyRow(row: Record<string, unknown>): boolean {
  return drafts.has(rowKeyOf(row))
}

function setDraft(row: Record<string, unknown>, field: FieldDef, value: unknown) {
  const key = rowKeyOf(row)
  if (sameValue(value, row[field.key])) {
    const draft = drafts.get(key)
    if (draft) {
      delete draft[field.key]
      if (Object.keys(draft).length === 0) drafts.delete(key)
    }
  } else {
    let draft = drafts.get(key)
    if (!draft) {
      draft = {}
      drafts.set(key, draft)
    }
    draft[field.key] = value
  }
  clearRowErrors(key)
}

function revertCell(row: Record<string, unknown>, field: FieldDef) {
  const key = rowKeyOf(row)
  const draft = drafts.get(key)
  if (draft) {
    delete draft[field.key]
    if (Object.keys(draft).length === 0) drafts.delete(key)
  }
  clearRowErrors(key)
}

function clearRowErrors(key: RowKey) {
  if (validationErrors.value.length === 0) return
  validationErrors.value = validationErrors.value.filter((error) => error.key !== key)
}

/** props.data 更新后，草稿里与新原值相同的字段自动清除脏标记（保存成功的清理机制） */
function syncDrafts() {
  drafts.forEach((draft, key) => {
    const row = props.data.find((item) => rowKeyOf(item) === key)
    if (!row) return
    Object.keys(draft).forEach((fieldKey) => {
      if (sameValue(draft[fieldKey], row[fieldKey])) delete draft[fieldKey]
    })
    if (Object.keys(draft).length === 0) drafts.delete(key)
  })
  validationErrors.value = validationErrors.value.filter((error) => drafts.has(error.key))
}

watch(() => props.data, syncDrafts, { deep: true })

const dirtyKeys = computed<RowKey[]>(() => [...drafts.keys()])

watch(dirtyKeys, (keys, previous) => {
  if (JSON.stringify(keys) === JSON.stringify(previous)) return
  emit('dirty-change', keys)
})

/* ---------- 校验：只在保存时执行 ---------- */

function isEmptyValue(value: unknown): boolean {
  if (value === '' || value === undefined || value === null) return true
  return Array.isArray(value) && value.length === 0
}

async function validateField(field: FieldDef, value: unknown): Promise<string | null> {
  for (const rule of field.rules ?? []) {
    if (rule.required && isEmptyValue(value)) {
      return rule.message ?? `${field.label}不能为空`
    }

    const filled = !isEmptyValue(value)

    if (filled && rule.min !== undefined) {
      const tooSmall =
        typeof value === 'number' ? value < rule.min : String(value).length < rule.min
      if (tooSmall) return rule.message ?? `${field.label}不能小于 ${rule.min}`
    }

    if (filled && rule.max !== undefined) {
      const tooLarge =
        typeof value === 'number' ? value > rule.max : String(value).length > rule.max
      if (tooLarge) return rule.message ?? `${field.label}不能大于 ${rule.max}`
    }

    if (filled && rule.pattern && !rule.pattern.test(String(value))) {
      return rule.message ?? `${field.label}格式不正确`
    }

    if (rule.validator) {
      try {
        const result = await rule.validator(value)
        if (typeof result === 'string') return result
      } catch (error) {
        if (error instanceof Error && error.message) return error.message
        return `${field.label}校验失败`
      }
    }
  }

  // 兜底：数字字段的 min / max 属于展示约束，保存时同样生效
  if (typeof value === 'number' && field.type === 'number') {
    if (field.min !== undefined && value < field.min) return `${field.label}不能小于 ${field.min}`
    if (field.max !== undefined && value > field.max) return `${field.label}不能大于 ${field.max}`
  }

  return null
}

/* ---------- 保存 / 撤销 ---------- */

async function onSave() {
  if (validating.value) return
  validating.value = true

  try {
    const changes: AtEditableTableChange[] = []
    const errors: AtEditableTableError[] = []

    for (const [key, draft] of drafts) {
      const row = props.data.find((item) => rowKeyOf(item) === key)
      const patch: Record<string, unknown> = {}

      for (const fieldKey of Object.keys(draft)) {
        const field = props.fields.find((item) => item.key === fieldKey)
        if (!field || !isEditable(field)) continue
        patch[fieldKey] = draft[fieldKey]
        const message = await validateField(field, draft[fieldKey])
        if (message) errors.push({ key, field, message })
      }

      if (Object.keys(patch).length > 0) {
        changes.push({ key, patch, row })
      }
    }

    if (errors.length > 0) {
      validationErrors.value = errors
      emit('validate-fail', errors)
      return
    }

    validationErrors.value = []
    if (changes.length > 0) emit('save', { changes })
  } finally {
    validating.value = false
  }
}

function clearDrafts(keys: RowKey[]) {
  keys.forEach((key) => {
    drafts.delete(key)
    clearRowErrors(key)
  })
}

function onCancelRow(row: Record<string, unknown>) {
  const key = rowKeyOf(row)
  clearDrafts([key])
  emit('cancel', { keys: [key] })
}

function onCancelAll() {
  const keys = [...dirtyKeys.value]
  clearDrafts(keys)
  emit('cancel', { keys })
}

/* ---------- 单元格状态 ---------- */

function isCellEditable(field: FieldDef): boolean {
  return props.editable && isEditable(field)
}

function rowHasError(row: Record<string, unknown>): boolean {
  return validationErrors.value.some((error) => error.key === rowKeyOf(row))
}

function cellError(row: Record<string, unknown>, fieldKey: string): string | undefined {
  const key = rowKeyOf(row)
  return validationErrors.value.find(
    (error) => error.key === key && error.field.key === fieldKey,
  )?.message
}

/* ---------- 控件读写 ---------- */

function textValue(row: Record<string, unknown>, field: FieldDef): string {
  const value = valueOf(row, field)
  return value === undefined || value === null ? '' : String(value)
}

function numberValue(row: Record<string, unknown>, field: FieldDef): string | number {
  const value = valueOf(row, field)
  return typeof value === 'number' || typeof value === 'string' ? value : ''
}

function selectValue(
  row: Record<string, unknown>,
  field: FieldDef,
): string | number | (string | number)[] | undefined {
  const value = valueOf(row, field)
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is string | number => typeof item === 'string' || typeof item === 'number',
    )
  }
  return typeof value === 'string' || typeof value === 'number' ? value : undefined
}

function booleanValue(row: Record<string, unknown>, field: FieldDef): string {
  const value = valueOf(row, field)
  if (value === true) return 'true'
  if (value === false) return 'false'
  return ''
}

function selectOptions(field: FieldDef) {
  return field.type === 'select' ? (field.options ?? []) : []
}

function selectMultiple(field: FieldDef): boolean {
  return field.type === 'select' ? Boolean(field.multiple) : false
}

function textMax(field: FieldDef): number | undefined {
  return field.type === 'text' ? field.maxLength : undefined
}

function onTextInput(row: Record<string, unknown>, field: FieldDef, event: Event) {
  setDraft(row, field, (event.target as HTMLInputElement).value)
}

function onNumberInput(row: Record<string, unknown>, field: FieldDef, event: Event) {
  const raw = (event.target as HTMLInputElement).value
  setDraft(row, field, raw === '' ? '' : Number(raw))
}

function onSelectChange(row: Record<string, unknown>, field: FieldDef, event: Event) {
  const select = event.target as HTMLSelectElement
  const options = selectOptions(field)
  const toRawValue = (value: string): string | number =>
    options.find((option) => String(option.value) === value)?.value ?? value

  if (selectMultiple(field)) {
    setDraft(
      row,
      field,
      Array.from(select.selectedOptions).map((option) => toRawValue(option.value)),
    )
    return
  }

  setDraft(row, field, select.value === '' ? '' : toRawValue(select.value))
}

function onBooleanChange(row: Record<string, unknown>, field: FieldDef, event: Event) {
  const raw = (event.target as HTMLSelectElement).value
  setDraft(row, field, raw === '' ? undefined : raw === 'true')
}

function onDateInput(row: Record<string, unknown>, field: FieldDef, event: Event) {
  setDraft(row, field, (event.target as HTMLInputElement).value)
}

/* ---------- 只读展示 ---------- */

const CustomCell = defineComponent({
  name: 'AtEditableTableCustomCell',
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

function labelOf(field: FieldDef, value: unknown): string {
  const options = 'options' in field ? (field.options ?? []) : []
  const matched = options.find((option) => option.value === value)
  return matched ? matched.label : value === undefined || value === null ? '' : String(value)
}

function displayValue(field: FieldDef, row: Record<string, unknown>): string {
  const value = row[field.key]
  if (field.type === 'boolean') return value ? (field.trueText ?? '是') : (field.falseText ?? '否')
  if (field.type === 'select') {
    if (field.multiple && Array.isArray(value)) {
      return value.map((entry) => labelOf(field, entry)).join('、')
    }
    return labelOf(field, value)
  }
  if (field.type === 'number') {
    if (value === undefined || value === null || value === '') return ''
    const text = field.precision === undefined ? String(value) : Number(value).toFixed(field.precision)
    return field.unit ? `${text} ${field.unit}` : text
  }
  return value === undefined || value === null ? '' : String(value)
}

function cellStyle(column: ColumnSchema): CSSProperties {
  return {
    width: column.width === undefined ? undefined : `${column.width}px`,
    textAlign: column.align,
  }
}
</script>

<template>
  <div
    class="at-editable-table"
    :aria-busy="loading || saving || undefined"
  >
    <div class="at-editable-table__toolbar">
      <slot name="toolbar">
        <button
          type="button"
          class="at-editable-table__btn at-editable-table__btn--primary"
          :disabled="dirtyKeys.length === 0 || saving || validating"
          @click="onSave"
        >
          保存 {{ dirtyKeys.length }} 项修改
        </button>
        <button
          type="button"
          class="at-editable-table__btn"
          :disabled="dirtyKeys.length === 0 || saving"
          @click="onCancelAll"
        >
          撤销全部
        </button>
      </slot>
    </div>

    <div class="at-editable-table__scroll">
      <table class="at-editable-table__table">
        <thead>
          <tr>
            <th
              v-for="columnItem in columns"
              :key="columnItem.column.key"
              scope="col"
              class="at-editable-table__th"
              :style="cellStyle(columnItem.column)"
            >
              {{ columnItem.column.title }}
            </th>
            <th scope="col" class="at-editable-table__th at-editable-table__th--ops">编辑</th>
          </tr>
        </thead>

        <tbody>
          <tr v-if="data.length === 0">
            <td :colspan="colspan" class="at-editable-table__empty">暂无数据</td>
          </tr>

          <tr
            v-for="rowItem in data"
            :key="String(rowKeyOf(rowItem))"
            class="at-editable-table__row"
            :class="{
              'at-editable-table__row--dirty': isDirtyRow(rowItem),
              'at-editable-table__row--invalid': rowHasError(rowItem),
            }"
          >
            <td
              v-for="columnItem in columns"
              :key="columnItem.column.key"
              class="at-editable-table__td"
              :style="cellStyle(columnItem.column)"
            >
              <template v-if="isCellEditable(columnItem.field)">
                <div class="at-editable-table__field">
                  <!-- text -->
                  <input
                    v-if="columnItem.field.type === 'text'"
                    :data-key="columnItem.column.key"
                    class="at-editable-table__input"
                    :class="{
                      'at-editable-table__control--invalid': cellError(rowItem, columnItem.column.key),
                    }"
                    type="text"
                    :value="textValue(rowItem, columnItem.field)"
                    :maxlength="textMax(columnItem.field)"
                    :disabled="saving"
                    @input="onTextInput(rowItem, columnItem.field, $event)"
                    @keydown.esc="revertCell(rowItem, columnItem.field)"
                  />

                  <!-- number -->
                  <input
                    v-else-if="columnItem.field.type === 'number'"
                    :data-key="columnItem.column.key"
                    class="at-editable-table__input"
                    :class="{
                      'at-editable-table__control--invalid': cellError(rowItem, columnItem.column.key),
                    }"
                    type="number"
                    :value="numberValue(rowItem, columnItem.field)"
                    :disabled="saving"
                    @input="onNumberInput(rowItem, columnItem.field, $event)"
                    @keydown.esc="revertCell(rowItem, columnItem.field)"
                  />

                  <!-- select -->
                  <select
                    v-else-if="columnItem.field.type === 'select'"
                    :data-key="columnItem.column.key"
                    class="at-editable-table__select"
                    :class="{
                      'at-editable-table__control--invalid': cellError(rowItem, columnItem.column.key),
                    }"
                    :multiple="selectMultiple(columnItem.field) || undefined"
                    :value="selectValue(rowItem, columnItem.field)"
                    :disabled="saving"
                    @change="onSelectChange(rowItem, columnItem.field, $event)"
                    @keydown.esc="revertCell(rowItem, columnItem.field)"
                  >
                    <option
                      v-for="optionItem in selectOptions(columnItem.field)"
                      :key="String(optionItem.value)"
                      :value="optionItem.value"
                    >
                      {{ optionItem.label }}
                    </option>
                  </select>

                  <!-- boolean -->
                  <select
                    v-else-if="columnItem.field.type === 'boolean'"
                    :data-key="columnItem.column.key"
                    class="at-editable-table__select"
                    :class="{
                      'at-editable-table__control--invalid': cellError(rowItem, columnItem.column.key),
                    }"
                    :value="booleanValue(rowItem, columnItem.field)"
                    :disabled="saving"
                    @change="onBooleanChange(rowItem, columnItem.field, $event)"
                    @keydown.esc="revertCell(rowItem, columnItem.field)"
                  >
                    <option value="" disabled>请选择</option>
                    <option value="true">{{ columnItem.field.trueText ?? '是' }}</option>
                    <option value="false">{{ columnItem.field.falseText ?? '否' }}</option>
                  </select>

                  <!-- date -->
                  <input
                    v-else-if="columnItem.field.type === 'date'"
                    :data-key="columnItem.column.key"
                    class="at-editable-table__input"
                    :class="{
                      'at-editable-table__control--invalid': cellError(rowItem, columnItem.column.key),
                    }"
                    type="date"
                    :value="textValue(rowItem, columnItem.field)"
                    :disabled="saving"
                    @input="onDateInput(rowItem, columnItem.field, $event)"
                    @keydown.esc="revertCell(rowItem, columnItem.field)"
                  />

                  <span
                    v-if="cellError(rowItem, columnItem.column.key)"
                    class="at-editable-table__error"
                  >
                    {{ cellError(rowItem, columnItem.column.key) }}
                  </span>
                </div>
              </template>

              <slot
                v-else
                :name="`cell-${columnItem.column.key}`"
                :row="rowItem"
                :value="rowItem[columnItem.column.key]"
                :field="columnItem.field"
              >
                <CustomCell
                  v-if="columnItem.field.type === 'custom'"
                  :field="asCustom(columnItem.field)"
                  :row="rowItem"
                />
                <span v-else class="at-editable-table__readonly">
                  {{ displayValue(columnItem.field, rowItem) }}
                </span>
              </slot>
            </td>

            <td class="at-editable-table__td at-editable-table__td--ops">
              <button
                v-if="isDirtyRow(rowItem)"
                type="button"
                class="at-editable-table__row-cancel"
                :disabled="saving"
                @click="onCancelRow(rowItem)"
              >
                撤销
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style>
.at-editable-table {
  display: flex;
  flex-direction: column;
  gap: var(--at-space-sm);
  border: 1px solid var(--at-color-border);
  border-radius: var(--at-radius-md);
  background-color: var(--at-color-bg);
  font-size: var(--at-font-base);
  line-height: var(--at-line-height);
}

.at-editable-table__toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--at-space-sm);
  padding: var(--at-space-sm) var(--at-space-md);
  border-bottom: 1px solid var(--at-color-border);
}

.at-editable-table__btn {
  height: var(--at-space-xl);
  padding: 0 var(--at-space-md);
  border: 1px solid var(--at-color-border);
  border-radius: var(--at-radius-sm);
  background-color: var(--at-color-bg);
  color: var(--at-color-text-1);
  font-size: var(--at-font-base);
  cursor: pointer;
  transition: background-color var(--at-duration-fast) var(--at-ease-out);
}

.at-editable-table__btn:hover:not(:disabled) {
  background-color: var(--at-color-fill-hover);
}

.at-editable-table__btn:focus-visible {
  outline: 2px solid var(--at-color-primary);
  outline-offset: 2px;
}

.at-editable-table__btn--primary {
  border-color: var(--at-color-primary);
  background-color: var(--at-color-primary);
  color: var(--at-color-text-inverse);
}

.at-editable-table__btn--primary:hover:not(:disabled) {
  background-color: var(--at-color-primary-hover);
}

.at-editable-table__btn:disabled,
.at-editable-table__row-cancel:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.at-editable-table__scroll {
  overflow-x: auto;
}

.at-editable-table__table {
  width: 100%;
  border-collapse: collapse;
}

.at-editable-table__th,
.at-editable-table__td {
  padding: var(--at-space-sm) var(--at-space-sm);
  border-bottom: 1px solid var(--at-color-border);
  text-align: left;
  vertical-align: top;
  white-space: nowrap;
}

.at-editable-table__th {
  background-color: var(--at-color-bg-subtle);
  color: var(--at-color-text-2);
  font-weight: 600;
  font-size: var(--at-font-sm);
}

.at-editable-table__th--ops,
.at-editable-table__td--ops {
  width: 1%;
  text-align: center;
}

.at-editable-table__row--dirty .at-editable-table__td:first-child {
  box-shadow: inset 3px 0 0 var(--at-color-warning);
}

.at-editable-table__field {
  display: flex;
  flex-direction: column;
  gap: var(--at-space-xs);
  min-width: 96px;
}

.at-editable-table__input,
.at-editable-table__select {
  width: 100%;
  height: var(--at-space-xl);
  padding: 0 var(--at-space-sm);
  border: 1px solid var(--at-color-border);
  border-radius: var(--at-radius-sm);
  background-color: var(--at-color-bg);
  color: var(--at-color-text-1);
  font-size: var(--at-font-base);
  line-height: var(--at-line-height);
  transition: border-color var(--at-duration-fast) var(--at-ease-out);
}

.at-editable-table__input:hover:not(:disabled),
.at-editable-table__select:hover:not(:disabled) {
  border-color: var(--at-color-primary);
}

.at-editable-table__input:focus-visible,
.at-editable-table__select:focus-visible {
  outline: 2px solid var(--at-color-primary);
  outline-offset: 2px;
}

.at-editable-table__control--invalid {
  border-color: var(--at-color-danger);
}

.at-editable-table__error {
  color: var(--at-color-danger);
  font-size: var(--at-font-sm);
}

.at-editable-table__readonly {
  color: var(--at-color-text-1);
}

.at-editable-table__row-cancel {
  padding: 0;
  border: none;
  background: none;
  color: var(--at-color-primary);
  font-size: var(--at-font-sm);
  cursor: pointer;
}

.at-editable-table__row-cancel:hover:not(:disabled) {
  color: var(--at-color-primary-hover);
}

.at-editable-table__row-cancel:focus-visible {
  outline: 2px solid var(--at-color-primary);
  outline-offset: 2px;
}

.at-editable-table__empty {
  padding: var(--at-space-lg);
  color: var(--at-color-text-3);
  text-align: center;
}
</style>
