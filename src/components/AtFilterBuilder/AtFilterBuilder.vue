<script setup lang="ts">
import { computed, h, reactive, watch } from 'vue'
import type { FunctionalComponent, VNode } from 'vue'

import type { FieldDef, FieldOption, FieldType, SearchOperator } from '../../types/schema'

import type {
  AtFilterBuilderProps,
  FilterGroup,
  FilterLeaf,
  FilterNode,
} from './types'

defineOptions({
  name: 'AtFilterBuilder',
})

const props = withDefaults(defineProps<AtFilterBuilderProps>(), {
  maxDepth: 3,
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [node: FilterNode | null]
  change: [node: FilterNode | null]
}>()

/** 每种字段类型允许的运算符，顺序即下拉顺序 */
const OPERATORS: Record<FieldType, SearchOperator[]> = {
  text: ['like', 'eq'],
  number: ['eq', 'gt', 'gte', 'lt', 'lte', 'between'],
  date: ['eq', 'between', 'gt', 'lt'],
  select: ['eq', 'in'],
  boolean: ['eq'],
  custom: [],
}

const OPERATOR_LABELS: Record<SearchOperator, string> = {
  eq: '等于',
  like: '包含',
  gt: '大于',
  gte: '大于等于',
  lt: '小于',
  lte: '小于等于',
  between: '介于',
  in: '属于',
}

/** custom 字段没有可用运算符，不进入字段下拉；其余字段不做额外可见性过滤 */
const selectableFields = computed(() => props.fields.filter((field) => OPERATORS[field.type].length > 0))

const maxDepth = computed(() => Math.max(1, Math.trunc(props.maxDepth)))

function fieldByKey(key: string): FieldDef | undefined {
  return props.fields.find((field) => field.key === key)
}

function operatorsFor(field: FieldDef | undefined): SearchOperator[] {
  return field ? OPERATORS[field.type] : []
}

/* ---------- 值工具 ---------- */

function emptyValue(operator: SearchOperator): unknown {
  if (operator === 'between') return ['', '']
  if (operator === 'in') return []
  return ''
}

function isEmptyValue(value: unknown): boolean {
  if (value === '' || value === undefined || value === null) return true
  if (Array.isArray(value)) {
    return value.every((item) => item === '' || item === undefined || item === null)
  }
  return false
}

function cloneValue(value: unknown): unknown {
  return Array.isArray(value) ? value.slice() : value
}

function cloneNode(node: FilterNode): FilterNode {
  if (node.type === 'condition') {
    return {
      type: 'condition',
      key: node.key,
      operator: node.operator,
      value: cloneValue(node.value),
    }
  }
  return {
    type: 'group',
    logic: node.logic,
    children: node.children.map(cloneNode),
  }
}

/** 剪枝：空值叶子与空组一律剔除；整棵树为空返回 null */
function pruneGroup(group: FilterGroup): FilterGroup | null {
  const children: FilterNode[] = []

  group.children.forEach((child) => {
    if (child.type === 'condition') {
      if (!isEmptyValue(child.value)) children.push(cloneNode(child))
      return
    }
    const pruned = pruneGroup(child)
    if (pruned) children.push(pruned)
  })

  if (children.length === 0) return null
  return { type: 'group', logic: group.logic, children }
}

/** 回填：未知 key 静默丢弃，非法运算符回落到该字段的第一个可用运算符 */
function sanitizeNode(node: FilterNode): FilterNode | null {
  if (node.type === 'condition') {
    const field = fieldByKey(node.key)
    if (!field) return null
    const operators = operatorsFor(field)
    if (operators.length === 0) return null
    const operator = operators.includes(node.operator) ? node.operator : operators[0]
    return {
      type: 'condition',
      key: node.key,
      operator,
      value: node.value === undefined ? emptyValue(operator) : cloneValue(node.value),
    }
  }

  const children = Array.isArray(node.children)
    ? node.children
        .map(sanitizeNode)
        .filter((child): child is FilterNode => child !== null)
    : []

  return { type: 'group', logic: node.logic === 'or' ? 'or' : 'and', children }
}

function sanitizeRoot(node: FilterNode | null | undefined): FilterGroup {
  const sanitized = node ? sanitizeNode(node) : null
  if (!sanitized) return { type: 'group', logic: 'and', children: [] }
  if (sanitized.type === 'group') return sanitized
  return { type: 'group', logic: 'and', children: [sanitized] }
}

/* ---------- 内部状态 ---------- */

const root = reactive<FilterGroup>(sanitizeRoot(props.modelValue))
let lastEmitted = ''

function applyModel(node: FilterNode | null | undefined) {
  const next = sanitizeRoot(node)
  root.logic = next.logic
  root.children = next.children
}

function emitTree() {
  const pruned = pruneGroup(root)
  const payload = pruned ? (cloneNode(pruned) as FilterNode) : null
  lastEmitted = JSON.stringify(payload)
  emit('update:modelValue', payload)
  emit('change', payload)
}

watch(
  () => props.modelValue,
  (next) => {
    if (JSON.stringify(next ?? null) === lastEmitted) return
    applyModel(next)
  },
  { deep: true },
)

/* ---------- 变动 ---------- */

function addCondition(group: FilterGroup) {
  const field = selectableFields.value[0]
  if (!field) return
  const operator = OPERATORS[field.type][0]
  group.children.push({
    type: 'condition',
    key: field.key,
    operator,
    value: emptyValue(operator),
  })
  emitTree()
}

function addGroup(group: FilterGroup) {
  group.children.push({ type: 'group', logic: 'and', children: [] })
  emitTree()
}

function removeLeaf(group: FilterGroup, leaf: FilterLeaf) {
  const index = group.children.indexOf(leaf)
  if (index < 0) return
  group.children.splice(index, 1)
  emitTree()
}

function onLogicChange(group: FilterGroup, event: Event) {
  group.logic = (event.target as HTMLSelectElement).value === 'or' ? 'or' : 'and'
  emitTree()
}

function onFieldChange(leaf: FilterLeaf, event: Event) {
  const field = fieldByKey((event.target as HTMLSelectElement).value)
  if (!field) return
  const operators = operatorsFor(field)
  leaf.key = field.key
  leaf.operator = operators[0]
  leaf.value = emptyValue(leaf.operator)
  emitTree()
}

function onOperatorChange(leaf: FilterLeaf, event: Event) {
  const field = fieldByKey(leaf.key)
  if (!field) return
  const operator = (event.target as HTMLSelectElement).value as SearchOperator
  if (!operatorsFor(field).includes(operator)) return

  leaf.operator = operator
  if (operator === 'between') leaf.value = ['', '']
  else if (operator === 'in') leaf.value = []
  else if (Array.isArray(leaf.value)) leaf.value = ''
  emitTree()
}

/* ---------- 值控件读写 ---------- */

function parseNumber(raw: string): string | number {
  if (raw === '') return ''
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : raw
}

function optionValue(field: FieldDef, raw: string): string | number {
  if (field.type !== 'select') return raw
  return field.options?.find((option) => String(option.value) === raw)?.value ?? raw
}

function selectOptions(field: FieldDef): FieldOption[] {
  return field.type === 'select' ? (field.options ?? []) : []
}

function stringValue(value: unknown): string {
  return value === undefined || value === null ? '' : String(value)
}

function booleanValue(value: unknown): string {
  if (value === true) return 'true'
  if (value === false) return 'false'
  return ''
}

function inputType(field: FieldDef): string {
  if (field.type === 'number') return 'number'
  if (field.type === 'date') return 'date'
  return 'text'
}

function onTextInput(leaf: FilterLeaf, event: Event) {
  leaf.value = (event.target as HTMLInputElement).value
  emitTree()
}

function onNumberInput(leaf: FilterLeaf, event: Event) {
  leaf.value = parseNumber((event.target as HTMLInputElement).value)
  emitTree()
}

function onDateInput(leaf: FilterLeaf, event: Event) {
  leaf.value = (event.target as HTMLInputElement).value
  emitTree()
}

function onRangeInput(leaf: FilterLeaf, field: FieldDef, index: 0 | 1, event: Event) {
  const current: unknown[] = Array.isArray(leaf.value) ? [...leaf.value] : ['', '']
  const raw = (event.target as HTMLInputElement).value
  current[index] = field.type === 'number' ? parseNumber(raw) : raw
  leaf.value = current
  emitTree()
}

function onSelectInput(leaf: FilterLeaf, field: FieldDef, event: Event) {
  const raw = (event.target as HTMLSelectElement).value
  leaf.value = raw === '' ? '' : optionValue(field, raw)
  emitTree()
}

function onMultiSelectInput(leaf: FilterLeaf, field: FieldDef, event: Event) {
  const select = event.target as HTMLSelectElement
  leaf.value = Array.from(select.selectedOptions).map((option) =>
    optionValue(field, option.value),
  )
  emitTree()
}

function onBooleanInput(leaf: FilterLeaf, event: Event) {
  const raw = (event.target as HTMLSelectElement).value
  leaf.value = raw === '' ? '' : raw === 'true'
  emitTree()
}

/* ---------- 渲染 ---------- */

function renderValue(leaf: FilterLeaf, field: FieldDef | undefined): VNode {
  if (!field) return h('span', { class: 'at-filter-builder__value' })

  const type = inputType(field)

  if (leaf.operator === 'between') {
    const parts: unknown[] = Array.isArray(leaf.value) ? leaf.value : ['', '']
    return h('span', { class: 'at-filter-builder__value at-filter-builder__range' }, [
      h('input', {
        class: 'at-filter-builder__input',
        type,
        value: stringValue(parts[0]),
        disabled: props.disabled,
        'aria-label': `${field.label}下限`,
        onInput: (event: Event) => onRangeInput(leaf, field, 0, event),
      }),
      h('span', { class: 'at-filter-builder__range-sep', 'aria-hidden': 'true' }, '至'),
      h('input', {
        class: 'at-filter-builder__input',
        type,
        value: stringValue(parts[1]),
        disabled: props.disabled,
        'aria-label': `${field.label}上限`,
        onInput: (event: Event) => onRangeInput(leaf, field, 1, event),
      }),
    ])
  }

  if (leaf.operator === 'in') {
    const selected = Array.isArray(leaf.value) ? leaf.value : []
    return h(
      'select',
      {
        class: 'at-filter-builder__value at-filter-builder__select',
        multiple: true,
        disabled: props.disabled,
        'aria-label': `${field.label}取值`,
        onChange: (event: Event) => onMultiSelectInput(leaf, field, event),
      },
      selectOptions(field).map((option) =>
        h(
          'option',
          {
            value: option.value,
            selected: selected.some((item) => Object.is(item, option.value)),
          },
          option.label,
        ),
      ),
    )
  }

  if (field.type === 'boolean') {
    return h(
      'select',
      {
        class: 'at-filter-builder__value at-filter-builder__select',
        value: booleanValue(leaf.value),
        disabled: props.disabled,
        'aria-label': `${field.label}取值`,
        onChange: (event: Event) => onBooleanInput(leaf, event),
      },
      [
        h('option', { value: '' }, '请选择'),
        h('option', { value: 'true' }, field.trueText ?? '是'),
        h('option', { value: 'false' }, field.falseText ?? '否'),
      ],
    )
  }

  if (field.type === 'select') {
    return h(
      'select',
      {
        class: 'at-filter-builder__value at-filter-builder__select',
        value: stringValue(leaf.value),
        disabled: props.disabled,
        'aria-label': `${field.label}取值`,
        onChange: (event: Event) => onSelectInput(leaf, field, event),
      },
      [
        h('option', { value: '' }, '请选择'),
        ...selectOptions(field).map((option) =>
          h('option', { value: option.value }, option.label),
        ),
      ],
    )
  }

  const onInput =
    field.type === 'number'
      ? (event: Event) => onNumberInput(leaf, event)
      : field.type === 'date'
        ? (event: Event) => onDateInput(leaf, event)
        : (event: Event) => onTextInput(leaf, event)

  return h('span', { class: 'at-filter-builder__value' }, [
    h('input', {
      class: 'at-filter-builder__input',
      type,
      value: stringValue(leaf.value),
      disabled: props.disabled,
      'aria-label': `${field.label}取值`,
      onInput,
    }),
  ])
}

function renderLeaf(group: FilterGroup, leaf: FilterLeaf, index: number): VNode {
  const field = fieldByKey(leaf.key)

  return h('div', { class: 'at-filter-builder__row', key: `condition-${index}` }, [
    h(
      'select',
      {
        class: 'at-filter-builder__field',
        value: leaf.key,
        disabled: props.disabled,
        'aria-label': '字段',
        onChange: (event: Event) => onFieldChange(leaf, event),
      },
      selectableFields.value.map((item) =>
        h('option', { value: item.key }, item.label),
      ),
    ),
    h(
      'select',
      {
        class: 'at-filter-builder__operator',
        value: leaf.operator,
        disabled: props.disabled,
        'aria-label': '运算符',
        onChange: (event: Event) => onOperatorChange(leaf, event),
      },
      operatorsFor(field).map((operator) =>
        h('option', { value: operator }, OPERATOR_LABELS[operator]),
      ),
    ),
    renderValue(leaf, field),
    h(
      'button',
      {
        type: 'button',
        class: 'at-filter-builder__remove',
        disabled: props.disabled,
        'aria-label': `删除条件 ${field?.label ?? leaf.key}`,
        onClick: () => {
          if (props.disabled) return
          removeLeaf(group, leaf)
        },
      },
      '删除',
    ),
  ])
}

function renderGroup(group: FilterGroup, depth: number): VNode {
  const head = h('div', { class: 'at-filter-builder__group-head' }, [
    h(
      'span',
      { class: 'at-filter-builder__group-label' },
      depth === 1 ? '条件组' : '子条件组',
    ),
    h(
      'select',
      {
        class: 'at-filter-builder__logic',
        value: group.logic,
        disabled: props.disabled,
        'aria-label': '组内逻辑',
        onChange: (event: Event) => onLogicChange(group, event),
      },
      [
        h('option', { value: 'and' }, '全部满足（AND）'),
        h('option', { value: 'or' }, '任一满足（OR）'),
      ],
    ),
    h(
      'button',
      {
        type: 'button',
        class: 'at-filter-builder__add-condition',
        disabled: props.disabled || selectableFields.value.length === 0,
        onClick: () => {
          if (props.disabled || selectableFields.value.length === 0) return
          addCondition(group)
        },
      },
      '添加条件',
    ),
    h(
      'button',
      {
        type: 'button',
        class: 'at-filter-builder__add-group',
        disabled: props.disabled || depth >= maxDepth.value,
        onClick: () => {
          if (props.disabled || depth >= maxDepth.value) return
          addGroup(group)
        },
      },
      '添加分组',
    ),
  ])

  const children: VNode[] =
    group.children.length === 0
      ? [h('p', { class: 'at-filter-builder__empty' }, '暂无条件')]
      : group.children.map((child, index) =>
          child.type === 'group'
            ? renderGroup(child, depth + 1)
            : renderLeaf(group, child, index),
        )

  return h(
    'div',
    { class: 'at-filter-builder__group', 'data-depth': depth },
    [head, h('div', { class: 'at-filter-builder__children' }, children)],
  )
}

/** 根组以函数式组件渲染，条件组的递归不需要额外的组件文件 */
const Tree: FunctionalComponent = () => renderGroup(root, 1)
</script>

<template>
  <div class="at-filter-builder" :class="{ 'at-filter-builder--disabled': disabled }">
    <Tree />
  </div>
</template>

<style>
.at-filter-builder {
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

.at-filter-builder__group {
  display: flex;
  flex-direction: column;
  gap: var(--at-space-sm);
  min-width: 0;
}

.at-filter-builder__children {
  display: flex;
  flex-direction: column;
  gap: var(--at-space-sm);
  min-width: 0;
}

/* 只有嵌套组带缩进竖线，根组没有 */
.at-filter-builder__children > .at-filter-builder__group {
  padding-left: var(--at-space-md);
  border-left: 2px solid var(--at-color-border);
}

.at-filter-builder__group-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--at-space-sm);
}

.at-filter-builder__group-label {
  color: var(--at-color-text-2);
  font-size: var(--at-font-sm);
}

.at-filter-builder__logic,
.at-filter-builder__field,
.at-filter-builder__operator,
.at-filter-builder__select {
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

.at-filter-builder__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--at-space-sm);
  padding: var(--at-space-sm);
  border-radius: var(--at-radius-sm);
  background-color: var(--at-color-bg-subtle);
}

.at-filter-builder__value {
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
}

.at-filter-builder__input {
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

.at-filter-builder__range {
  gap: var(--at-space-xs);
}

.at-filter-builder__range-sep,
.at-filter-builder__empty {
  flex: none;
  color: var(--at-color-text-3);
  font-size: var(--at-font-sm);
}

.at-filter-builder__empty {
  margin: 0;
  padding: var(--at-space-sm) 0;
}

.at-filter-builder__add-condition,
.at-filter-builder__add-group,
.at-filter-builder__remove {
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

.at-filter-builder__add-condition:hover:not(:disabled),
.at-filter-builder__add-group:hover:not(:disabled) {
  border-color: var(--at-color-primary);
  color: var(--at-color-primary);
}

.at-filter-builder__remove {
  border-color: transparent;
  color: var(--at-color-danger);
}

.at-filter-builder__remove:hover:not(:disabled) {
  background-color: var(--at-color-fill-hover);
}

.at-filter-builder__logic:hover,
.at-filter-builder__field:hover,
.at-filter-builder__operator:hover,
.at-filter-builder__select:hover,
.at-filter-builder__input:hover {
  border-color: var(--at-color-primary);
}

.at-filter-builder__logic:focus-visible,
.at-filter-builder__field:focus-visible,
.at-filter-builder__operator:focus-visible,
.at-filter-builder__select:focus-visible,
.at-filter-builder__input:focus-visible,
.at-filter-builder__add-condition:focus-visible,
.at-filter-builder__add-group:focus-visible,
.at-filter-builder__remove:focus-visible {
  outline: 2px solid var(--at-color-primary);
  outline-offset: 2px;
}

.at-filter-builder__add-condition:disabled,
.at-filter-builder__add-group:disabled,
.at-filter-builder__remove:disabled,
.at-filter-builder__logic:disabled,
.at-filter-builder__field:disabled,
.at-filter-builder__operator:disabled,
.at-filter-builder__select:disabled,
.at-filter-builder__input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.at-filter-builder__select[multiple] {
  height: auto;
  min-height: var(--at-space-xl);
  padding: var(--at-space-xs) var(--at-space-sm);
}

.at-filter-builder--disabled {
  background-color: var(--at-color-bg-subtle);
}
</style>
