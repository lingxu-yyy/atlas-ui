<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'

import { usePopover } from '../../composables/usePopover'
import { getVisibleRange, scrollTopForIndex } from '../../utils/virtual'
import type { FieldOption } from '../../types/schema'

import type { AtVirtualSelectProps } from './types'

defineOptions({
  name: 'AtVirtualSelect',
})

const props = withDefaults(defineProps<AtVirtualSelectProps>(), {
  placeholder: '请选择',
  disabled: false,
  itemHeight: 32,
  overscan: 4,
  maxVisibleItems: 8,
})

const emit = defineEmits<{
  'update:modelValue': [value: unknown]
  search: [keyword: string]
}>()

const REMOTE_DEBOUNCE = 300

const uid = useId()
const listId = `${uid}-list`

function optionId(index: number): string {
  return `${uid}-option-${index}`
}

/* ---------- 选项来源与过滤 ---------- */

/** 只有同时具备 loadOptions 与 filterable 才走远程，否则一律用 field.options */
const isRemote = computed(() => Boolean(props.field.loadOptions) && Boolean(props.field.filterable))

const remoteOptions = ref<FieldOption[]>([])
const loading = ref(false)
const keyword = ref('')

const filteredOptions = computed<FieldOption[]>(() => {
  if (isRemote.value) return remoteOptions.value

  const options = props.field.options ?? []
  const text = keyword.value.trim().toLowerCase()
  if (!props.field.filterable || !text) return options
  return options.filter((option) => option.label.toLowerCase().includes(text))
})

/* ---------- 选中值 ---------- */

const selectedValues = computed<unknown[]>(() => {
  const value = props.modelValue
  if (props.field.multiple) return Array.isArray(value) ? value : []
  if (value === undefined || value === null || value === '') return []
  return [value]
})

function isSelected(option: FieldOption): boolean {
  return selectedValues.value.some((value) => Object.is(value, option.value))
}

function labelOf(value: unknown): string {
  const pool = [...(props.field.options ?? []), ...remoteOptions.value]
  const matched = pool.find((option) => Object.is(option.value, value))
  if (matched) return matched.label
  return value === undefined || value === null ? '' : String(value)
}

/* ---------- 开关与浮层 ---------- */

const open = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)
const listRef = ref<HTMLElement | null>(null)

const activeIndex = ref(-1)
const scrollTop = ref(0)

const { style: popoverStyle } = usePopover({
  trigger: triggerRef,
  content: contentRef,
  open,
  onClose: close,
})

const listHeight = computed(() => props.itemHeight * props.maxVisibleItems)

const visibleRange = computed(() =>
  getVisibleRange({
    scrollTop: scrollTop.value,
    viewportHeight: listHeight.value,
    itemHeight: props.itemHeight,
    total: filteredOptions.value.length,
    overscan: props.overscan,
  }),
)

interface RenderedOption {
  option: FieldOption
  index: number
}

const renderedOptions = computed<RenderedOption[]>(() => {
  const { start, end } = visibleRange.value
  return filteredOptions.value
    .slice(start, end)
    .map((option, offset) => ({ option, index: start + offset }))
})

const activeOptionId = computed(() =>
  open.value && activeIndex.value >= 0 ? optionId(activeIndex.value) : undefined,
)

const searchText = computed(() => {
  if (open.value) return keyword.value
  if (props.field.multiple) return ''
  return selectedValues.value.length > 0 ? labelOf(selectedValues.value[0]) : ''
})

function firstSelectedIndex(): number {
  if (selectedValues.value.length === 0) return -1
  return filteredOptions.value.findIndex((option) => isSelected(option))
}

function openPanel() {
  if (props.disabled || open.value) return
  open.value = true

  const selected = firstSelectedIndex()
  activeIndex.value = selected >= 0 ? selected : filteredOptions.value.length > 0 ? 0 : -1

  nextTick(() => {
    const list = listRef.value
    if (!list) return
    list.scrollTop = scrollTopForIndex(
      Math.max(0, activeIndex.value),
      props.itemHeight,
      listHeight.value,
    )
    scrollTop.value = list.scrollTop
  })

  if (isRemote.value) scheduleRemoteSearch()
}

function close() {
  if (!open.value) return
  open.value = false
  keyword.value = ''
  activeIndex.value = -1
  scrollTop.value = 0
  cancelRemoteSearch()
}

function toggle() {
  if (open.value) close()
  else openPanel()
}

/* ---------- 远程搜索 ---------- */

let searchTimer: ReturnType<typeof setTimeout> | undefined
let searchToken = 0

function cancelRemoteSearch() {
  if (searchTimer !== undefined) {
    clearTimeout(searchTimer)
    searchTimer = undefined
  }
  searchToken += 1
}

function scheduleRemoteSearch() {
  const loader = props.field.loadOptions
  if (!loader) return
  if (searchTimer !== undefined) clearTimeout(searchTimer)

  searchTimer = setTimeout(async () => {
    searchTimer = undefined
    const token = ++searchToken
    loading.value = true
    try {
      const options = await loader()
      if (token === searchToken) remoteOptions.value = options
    } catch {
      if (token === searchToken) remoteOptions.value = []
    } finally {
      if (token === searchToken) loading.value = false
    }
  }, REMOTE_DEBOUNCE)
}

watch(keyword, (value) => {
  if (!isRemote.value) return
  emit('search', value)
  if (open.value) scheduleRemoteSearch()
})

/* ---------- 选中与移除 ---------- */

function choose(option: FieldOption) {
  if (props.disabled) return

  if (props.field.multiple) {
    const next = [...selectedValues.value]
    const position = next.findIndex((value) => Object.is(value, option.value))
    if (position >= 0) next.splice(position, 1)
    else next.push(option.value)
    emit('update:modelValue', next)
    return
  }

  emit('update:modelValue', option.value)
  close()
}

function removeValue(index: number) {
  if (props.disabled) return
  const next = [...selectedValues.value]
  next.splice(index, 1)
  emit('update:modelValue', next)
}

/* ---------- 交互 ---------- */

function onTriggerClick(event: MouseEvent) {
  if (props.disabled) return
  const target = event.target as HTMLElement | null
  if (target?.closest('[data-tag-remove]')) return
  if (target?.closest('input')) {
    openPanel()
    return
  }
  toggle()
}

function onKeywordInput(event: Event) {
  keyword.value = (event.target as HTMLInputElement).value
  if (!open.value) openPanel()
}

function onScroll(event: Event) {
  scrollTop.value = (event.target as HTMLElement).scrollTop
}

function setActive(index: number) {
  activeIndex.value = index
  const list = listRef.value
  if (!list) return
  list.scrollTop = scrollTopForIndex(index, props.itemHeight, listHeight.value)
  scrollTop.value = list.scrollTop
}

function moveActive(delta: number) {
  const total = filteredOptions.value.length
  if (total === 0) return
  const base = activeIndex.value < 0 ? (delta > 0 ? -1 : total) : activeIndex.value
  setActive(Math.min(Math.max(0, base + delta), total - 1))
}

function onTriggerKeydown(event: KeyboardEvent) {
  if (props.disabled) return
  const key = event.key

  if (key === 'Escape') {
    if (open.value) {
      event.preventDefault()
      close()
    }
    return
  }

  if (key === 'Tab') {
    if (open.value) close()
    return
  }

  if (key === 'ArrowDown' || key === 'ArrowUp') {
    event.preventDefault()
    if (!open.value) {
      openPanel()
      return
    }
    moveActive(key === 'ArrowDown' ? 1 : -1)
    return
  }

  if (key === 'Home' || key === 'End') {
    if (!open.value || filteredOptions.value.length === 0) return
    event.preventDefault()
    setActive(key === 'Home' ? 0 : filteredOptions.value.length - 1)
    return
  }

  if (key === 'Enter') {
    if (!open.value) return
    const option = filteredOptions.value[activeIndex.value]
    if (!option) return
    event.preventDefault()
    choose(option)
    return
  }

  if (key === 'Backspace' && props.field.multiple && !keyword.value) {
    if (selectedValues.value.length === 0) return
    removeValue(selectedValues.value.length - 1)
  }
}

/* ---------- 选项变化时重置可视区 ---------- */

watch(filteredOptions, (options) => {
  if (!open.value) return
  if (activeIndex.value >= options.length) activeIndex.value = options.length - 1
  if (activeIndex.value < 0 && options.length > 0) activeIndex.value = 0
  nextTick(() => {
    const list = listRef.value
    if (!list) return
    list.scrollTop = 0
    scrollTop.value = 0
  })
})

onBeforeUnmount(cancelRemoteSearch)
</script>

<template>
  <div
    ref="triggerRef"
    class="at-virtual-select"
    :class="{
      'at-virtual-select--open': open,
      'at-virtual-select--disabled': disabled,
    }"
    role="combobox"
    :tabindex="disabled ? -1 : 0"
    :aria-expanded="open"
    :aria-controls="listId"
    aria-haspopup="listbox"
    :aria-activedescendant="activeOptionId"
    :aria-disabled="disabled || undefined"
    @click="onTriggerClick"
    @keydown="onTriggerKeydown"
  >
    <div class="at-virtual-select__values">
      <template v-if="field.multiple">
        <span
          v-for="(value, index) in selectedValues"
          :key="String(value)"
          class="at-virtual-select__tag"
        >
          <span class="at-virtual-select__tag-label">{{ labelOf(value) }}</span>
          <button
            type="button"
            class="at-virtual-select__tag-remove"
            data-tag-remove
            :disabled="disabled"
            :aria-label="`移除 ${labelOf(value)}`"
            @click.stop="removeValue(index)"
          >
            ×
          </button>
        </span>
        <input
          v-if="field.filterable"
          class="at-virtual-select__search"
          type="text"
          role="searchbox"
          :value="searchText"
          :placeholder="selectedValues.length === 0 ? placeholder : ''"
          :disabled="disabled"
          :aria-controls="listId"
          @input="onKeywordInput"
          @focus="openPanel"
        />
        <span
          v-else-if="selectedValues.length === 0"
          class="at-virtual-select__placeholder"
        >
          {{ placeholder }}
        </span>
      </template>

      <template v-else>
        <input
          v-if="field.filterable"
          class="at-virtual-select__search"
          type="text"
          role="searchbox"
          :value="searchText"
          :placeholder="placeholder"
          :disabled="disabled"
          :aria-controls="listId"
          @input="onKeywordInput"
          @focus="openPanel"
        />
        <span
          v-else
          class="at-virtual-select__value"
          :class="{ 'at-virtual-select__placeholder': selectedValues.length === 0 }"
        >
          {{ selectedValues.length > 0 ? labelOf(selectedValues[0]) : placeholder }}
        </span>
      </template>

      <span class="at-virtual-select__caret" aria-hidden="true">▾</span>
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="open"
      ref="contentRef"
      class="at-virtual-select__panel"
      :style="popoverStyle"
    >
      <div
        v-if="loading"
        class="at-virtual-select__status"
        :style="{ height: `${listHeight}px` }"
      >
        加载中…
      </div>

      <div
        v-else-if="filteredOptions.length === 0"
        class="at-virtual-select__status"
        :style="{ height: `${listHeight}px` }"
      >
        无匹配项
      </div>

      <div
        v-else
        :id="listId"
        ref="listRef"
        class="at-virtual-select__list"
        role="listbox"
        :style="{ height: `${listHeight}px` }"
        @scroll="onScroll"
      >
        <div
          class="at-virtual-select__spacer"
          :style="{ height: `${visibleRange.totalHeight}px` }"
        >
          <div
            class="at-virtual-select__slice"
            :style="{ transform: `translateY(${visibleRange.offsetY}px)` }"
          >
            <div
              v-for="item in renderedOptions"
              :id="optionId(item.index)"
              :key="String(item.option.value)"
              class="at-virtual-select__option"
              :class="{
                'at-virtual-select__option--active': item.index === activeIndex,
                'at-virtual-select__option--selected': isSelected(item.option),
                'at-virtual-select__option--disabled': item.option.disabled,
              }"
              role="option"
              :aria-selected="isSelected(item.option)"
              :aria-disabled="item.option.disabled || undefined"
              :style="{ height: `${itemHeight}px` }"
              @click="choose(item.option)"
            >
              <slot
                name="option"
                :option="item.option"
                :index="item.index"
                :selected="isSelected(item.option)"
              >
                {{ item.option.label }}
              </slot>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style>
.at-virtual-select {
  display: inline-flex;
  align-items: center;
  min-width: calc(var(--at-space-xl) * 5);
  min-height: var(--at-space-xl);
  padding: 0 var(--at-space-sm);
  border: 1px solid var(--at-color-border);
  border-radius: var(--at-radius-md);
  background-color: var(--at-color-bg);
  color: var(--at-color-text-1);
  font-size: var(--at-font-base);
  line-height: var(--at-line-height);
  cursor: pointer;
  transition: border-color var(--at-duration-fast) var(--at-ease-out);
}

.at-virtual-select:hover:not(.at-virtual-select--disabled) {
  border-color: var(--at-color-primary);
}

.at-virtual-select:focus-visible,
.at-virtual-select--open {
  outline: 2px solid var(--at-color-ring);
  outline-offset: 1px;
  border-color: var(--at-color-primary);
}

.at-virtual-select--disabled {
  background-color: var(--at-color-fill-hover);
  color: var(--at-color-text-3);
  cursor: not-allowed;
}

.at-virtual-select__values {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--at-space-xs);
  flex: 1;
  overflow: hidden;
}

.at-virtual-select__value {
  color: var(--at-color-text-1);
}

.at-virtual-select__placeholder {
  color: var(--at-color-text-3);
}

.at-virtual-select__caret {
  margin-left: var(--at-space-xs);
  color: var(--at-color-text-3);
  font-size: var(--at-font-sm);
}

.at-virtual-select__search {
  flex: 1;
  min-width: var(--at-space-xl);
  border: none;
  outline: none;
  background: transparent;
  color: var(--at-color-text-1);
  font-size: var(--at-font-base);
  line-height: var(--at-line-height);
}

.at-virtual-select__search::placeholder {
  color: var(--at-color-text-3);
}

.at-virtual-select__tag {
  display: inline-flex;
  align-items: center;
  gap: var(--at-space-xs);
  padding: 0 var(--at-space-xs);
  border: 1px solid var(--at-color-border);
  border-radius: var(--at-radius-sm);
  background-color: var(--at-color-bg-subtle);
  font-size: var(--at-font-sm);
}

.at-virtual-select__tag-remove {
  padding: 0;
  border: none;
  background: none;
  color: var(--at-color-text-2);
  font-size: var(--at-font-base);
  line-height: 1;
  cursor: pointer;
}

.at-virtual-select__tag-remove:hover:not(:disabled) {
  color: var(--at-color-danger);
}

.at-virtual-select__tag-remove:focus-visible {
  outline: 2px solid var(--at-color-primary);
  outline-offset: 1px;
}

.at-virtual-select__panel {
  min-width: calc(var(--at-space-xl) * 5);
  border: 1px solid var(--at-color-border);
  border-radius: var(--at-radius-md);
  background-color: var(--at-color-bg);
  box-shadow: var(--at-shadow-md);
  overflow: hidden;
}

.at-virtual-select__list {
  overflow-y: auto;
  overscroll-behavior: contain;
}

.at-virtual-select__spacer {
  position: relative;
}

.at-virtual-select__slice {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  will-change: transform;
}

.at-virtual-select__option {
  display: flex;
  align-items: center;
  height: var(--at-space-xl);
  padding: 0 var(--at-space-sm);
  color: var(--at-color-text-1);
  font-size: var(--at-font-base);
  line-height: var(--at-line-height);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}

.at-virtual-select__option:hover {
  background-color: var(--at-color-fill-hover);
}

.at-virtual-select__option--active {
  background-color: var(--at-color-fill-hover);
}

.at-virtual-select__option--selected {
  color: var(--at-color-primary);
  font-weight: 600;
}

.at-virtual-select__option--disabled {
  color: var(--at-color-text-3);
  cursor: not-allowed;
}

.at-virtual-select__status {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--at-color-text-3);
  font-size: var(--at-font-base);
}
</style>
