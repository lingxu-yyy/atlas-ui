<script setup lang="ts">
import { computed, reactive, ref, useId, watch } from 'vue'

import { getDefaultValue, isSearchable } from '../../utils/schema'
import type { FieldDef, FieldOption, SearchOperator } from '../../types/schema'

import type {
  AtSearchFormProps,
  AtSearchFormSearchPayload,
  SearchCondition,
} from './types'

defineOptions({
  name: 'AtSearchForm',
})

const props = withDefaults(defineProps<AtSearchFormProps>(), {
  columns: 3,
  collapsible: true,
  loading: false,
})

const emit = defineEmits<{
  'update:modelValue': [values: Record<string, unknown>]
  search: [payload: AtSearchFormSearchPayload]
  reset: [payload: AtSearchFormSearchPayload]
}>()

/** 与 AtProTable 共用同一个 isSearchable，不另写可见性规则 */
const searchableFields = computed(() => props.fields.filter((field) => isSearchable(field)))

const columns = computed(() => Math.min(3, Math.max(1, Math.round(props.columns))))

const uid = useId()

function fieldId(field: FieldDef): string {
  return `${uid}-${field.key}`
}

/**
 * 搜索区的“未筛选”状态必须为空值。
 * getDefaultValue 的 boolean 默认是 false，用于新建表单；
 * 但在搜索区 false 是有效筛选值（否），二者不能混为一谈，因此布尔字段未设置时用 '' 表示“全部”。
 */
function initialValue(field: FieldDef): unknown {
  if (field.type === 'boolean' && field.defaultValue === undefined) return ''
  return getDefaultValue(field)
}

function resolveValue(field: FieldDef): unknown {
  if (props.modelValue && field.key in props.modelValue) return props.modelValue[field.key]
  if (field.defaultValue !== undefined) return field.defaultValue
  return initialValue(field)
}

const values = reactive<Record<string, unknown>>({})

function initValues() {
  searchableFields.value.forEach((field) => {
    if (!(field.key in values)) values[field.key] = resolveValue(field)
  })
}

initValues()

watch(
  () => props.fields,
  () => initValues(),
)

watch(
  () => props.modelValue,
  (next) => {
    if (!next) return
    Object.keys(next).forEach((key) => {
      values[key] = next[key]
    })
  },
  { deep: true },
)

/* ---------- 折叠 ---------- */

const expanded = ref(false)

const canCollapse = computed(
  () => props.collapsible && searchableFields.value.length > columns.value * 2,
)

const visibleFields = computed<FieldDef[]>(() => {
  if (!canCollapse.value || expanded.value) return searchableFields.value
  return searchableFields.value.slice(0, columns.value * 2)
})

/* ---------- 条件推导 ---------- */

function isEmptyValue(value: unknown): boolean {
  if (value === '' || value === undefined || value === null) return true
  return Array.isArray(value) && value.length === 0
}

function operatorOf(field: FieldDef): SearchOperator {
  switch (field.type) {
    case 'text':
      return 'like'
    case 'number':
      return 'eq'
    case 'select':
      return field.multiple ? 'in' : 'eq'
    case 'date':
      return field.range ? 'between' : 'eq'
    default:
      return 'eq'
  }
}

function buildPayload(): AtSearchFormSearchPayload {
  const payloadValues: Record<string, unknown> = {}
  const conditions: SearchCondition[] = []

  searchableFields.value.forEach((field) => {
    const value = values[field.key]
    if (isEmptyValue(value)) return
    payloadValues[field.key] = value
    conditions.push({ key: field.key, operator: operatorOf(field), value })
  })

  return { values: payloadValues, conditions }
}

function onSearch() {
  emit('search', buildPayload())
}

function onReset() {
  searchableFields.value.forEach((field) => {
    values[field.key] = initialValue(field)
  })
  emit('update:modelValue', { ...values })
  emit('reset', buildPayload())
}

function updateValue(key: string, value: unknown) {
  values[key] = value
  emit('update:modelValue', { ...values })
}

/* ---------- 控件读写 ---------- */

function textValue(field: FieldDef): string {
  const value = values[field.key]
  return value === undefined || value === null ? '' : String(value)
}

function numberValue(field: FieldDef): string | number {
  const value = values[field.key]
  return typeof value === 'number' || typeof value === 'string' ? value : ''
}

function selectValue(field: FieldDef): string | number | (string | number)[] | undefined {
  const value = values[field.key]
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is string | number => typeof item === 'string' || typeof item === 'number',
    )
  }
  return typeof value === 'string' || typeof value === 'number' ? value : undefined
}

function booleanValue(field: FieldDef): string {
  const value = values[field.key]
  if (value === true) return 'true'
  if (value === false) return 'false'
  return ''
}

function rangePart(field: FieldDef, index: 0 | 1): string {
  const value = values[field.key]
  if (!Array.isArray(value)) return ''
  return String(value[index] ?? '')
}

function textMax(field: FieldDef): number | undefined {
  return field.type === 'text' ? field.maxLength : undefined
}

function selectOptions(field: FieldDef): FieldOption[] {
  return field.type === 'select' ? (field.options ?? []) : []
}

function selectMultiple(field: FieldDef): boolean {
  return field.type === 'select' ? Boolean(field.multiple) : false
}

function dateRange(field: FieldDef): boolean {
  return field.type === 'date' ? Boolean(field.range) : false
}

function onTextInput(key: string, event: Event) {
  updateValue(key, (event.target as HTMLInputElement).value)
}

function onNumberInput(key: string, event: Event) {
  const raw = (event.target as HTMLInputElement).value
  updateValue(key, raw === '' ? '' : Number(raw))
}

function onSelectChange(field: FieldDef, event: Event) {
  const select = event.target as HTMLSelectElement
  const options = selectOptions(field)
  const toRawValue = (value: string): string | number =>
    options.find((option) => String(option.value) === value)?.value ?? value

  if (selectMultiple(field)) {
    const selected = Array.from(select.selectedOptions).map((option) =>
      toRawValue(option.value),
    )
    updateValue(field.key, selected)
    return
  }

  updateValue(field.key, select.value === '' ? '' : toRawValue(select.value))
}

function onBooleanChange(key: string, event: Event) {
  const raw = (event.target as HTMLSelectElement).value
  updateValue(key, raw === '' ? '' : raw === 'true')
}

function onDateInput(key: string, event: Event) {
  updateValue(key, (event.target as HTMLInputElement).value)
}

function onRangeInput(field: FieldDef, index: 0 | 1, event: Event) {
  const next: string[] = [rangePart(field, 0), rangePart(field, 1)]
  next[index] = (event.target as HTMLInputElement).value
  updateValue(field.key, next[0] === '' && next[1] === '' ? [] : next)
}
</script>

<template>
  <form
    class="at-search-form"
    :class="`at-search-form--cols-${columns}`"
    :aria-busy="loading || undefined"
    @submit.prevent="onSearch"
  >
    <div class="at-search-form__fields">
      <div v-for="field in visibleFields" :key="field.key" class="at-search-form__item">
        <label class="at-search-form__label" :for="fieldId(field)">{{ field.label }}</label>

        <div class="at-search-form__control">
          <!-- text -->
          <input
            v-if="field.type === 'text'"
            :id="fieldId(field)"
            class="at-search-form__input"
            type="text"
            :value="textValue(field)"
            :maxlength="textMax(field)"
            :placeholder="field.hint ?? ''"
            @input="onTextInput(field.key, $event)"
          />

          <!-- number -->
          <input
            v-else-if="field.type === 'number'"
            :id="fieldId(field)"
            class="at-search-form__input"
            type="number"
            :value="numberValue(field)"
            @input="onNumberInput(field.key, $event)"
          />

          <!-- select（单选 / 多选） -->
          <select
            v-else-if="field.type === 'select'"
            :id="fieldId(field)"
            class="at-search-form__select"
            :multiple="selectMultiple(field) || undefined"
            :value="selectValue(field)"
            @change="onSelectChange(field, $event)"
          >
            <option v-if="!selectMultiple(field)" value="">全部</option>
            <option v-for="option in selectOptions(field)" :key="String(option.value)" :value="option.value">
              {{ option.label }}
            </option>
          </select>

          <!-- date 范围 -->
          <span v-else-if="field.type === 'date' && dateRange(field)" class="at-search-form__range">
            <input
              :id="fieldId(field)"
              class="at-search-form__input"
              type="date"
              :value="rangePart(field, 0)"
              @input="onRangeInput(field, 0, $event)"
            />
            <span class="at-search-form__range-sep" aria-hidden="true">至</span>
            <input
              class="at-search-form__input"
              type="date"
              :aria-label="`${field.label}结束`"
              :value="rangePart(field, 1)"
              @input="onRangeInput(field, 1, $event)"
            />
          </span>

          <!-- date 单值 -->
          <input
            v-else-if="field.type === 'date'"
            :id="fieldId(field)"
            class="at-search-form__input"
            type="date"
            :value="textValue(field)"
            @input="onDateInput(field.key, $event)"
          />

          <!-- boolean -->
          <select
            v-else-if="field.type === 'boolean'"
            :id="fieldId(field)"
            class="at-search-form__select"
            :value="booleanValue(field)"
            @change="onBooleanChange(field.key, $event)"
          >
            <option value="">全部</option>
            <option value="true">{{ field.trueText ?? '是' }}</option>
            <option value="false">{{ field.falseText ?? '否' }}</option>
          </select>
        </div>
      </div>
    </div>

    <div class="at-search-form__actions">
      <button
        v-if="canCollapse"
        type="button"
        class="at-search-form__toggle"
        @click="expanded = !expanded"
      >
        {{ expanded ? '收起' : '展开' }}
      </button>

      <slot name="actions">
        <button
          type="submit"
          class="at-search-form__btn at-search-form__btn--primary"
          :disabled="loading"
          @click.prevent="onSearch"
        >
          查询
        </button>
        <button type="button" class="at-search-form__btn" @click="onReset">重置</button>
      </slot>
    </div>
  </form>
</template>

<style>
.at-search-form {
  --at-search-columns: 3;

  display: flex;
  flex-direction: column;
  gap: var(--at-space-md);
  padding: var(--at-space-md);
  border: 1px solid var(--at-color-border);
  border-radius: var(--at-radius-md);
  background-color: var(--at-color-bg);
  font-size: var(--at-font-base);
  line-height: var(--at-line-height);
}

.at-search-form--cols-2 {
  --at-search-columns: 2;
}

.at-search-form--cols-1 {
  --at-search-columns: 1;
}

@media (max-width: 1024px) {
  .at-search-form--cols-3 {
    --at-search-columns: 2;
  }
}

@media (max-width: 640px) {
  .at-search-form--cols-3,
  .at-search-form--cols-2 {
    --at-search-columns: 1;
  }
}

.at-search-form__fields {
  display: grid;
  grid-template-columns: repeat(var(--at-search-columns), minmax(0, 1fr));
  gap: var(--at-space-sm) var(--at-space-md);
  align-items: end;
}

.at-search-form__item {
  display: flex;
  flex-direction: column;
  gap: var(--at-space-xs);
  min-width: 0;
}

.at-search-form__label {
  color: var(--at-color-text-2);
  font-size: var(--at-font-sm);
}

.at-search-form__control {
  min-width: 0;
}

.at-search-form__input,
.at-search-form__select {
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

.at-search-form__input:hover,
.at-search-form__select:hover {
  border-color: var(--at-color-primary);
}

.at-search-form__input:focus-visible,
.at-search-form__select:focus-visible {
  outline: 2px solid var(--at-color-primary);
  outline-offset: 2px;
}

.at-search-form__select[multiple] {
  height: auto;
  padding: var(--at-space-xs) var(--at-space-sm);
}

.at-search-form__range {
  display: flex;
  align-items: center;
  gap: var(--at-space-xs);
}

.at-search-form__range-sep {
  flex: none;
  color: var(--at-color-text-3);
  font-size: var(--at-font-sm);
}

.at-search-form__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--at-space-sm);
}

.at-search-form__toggle {
  margin-right: auto;
  padding: 0;
  border: none;
  background: none;
  color: var(--at-color-primary);
  font-size: var(--at-font-sm);
  cursor: pointer;
}

.at-search-form__toggle:hover {
  color: var(--at-color-primary-hover);
}

.at-search-form__toggle:focus-visible {
  outline: 2px solid var(--at-color-primary);
  outline-offset: 2px;
}

.at-search-form__btn {
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

.at-search-form__btn:hover:not(:disabled) {
  background-color: var(--at-color-fill-hover);
}

.at-search-form__btn:focus-visible {
  outline: 2px solid var(--at-color-primary);
  outline-offset: 2px;
}

.at-search-form__btn--primary {
  border-color: var(--at-color-primary);
  background-color: var(--at-color-primary);
  color: var(--at-color-text-inverse);
}

.at-search-form__btn--primary:hover:not(:disabled) {
  background-color: var(--at-color-primary-hover);
}

.at-search-form__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
