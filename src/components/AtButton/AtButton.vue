<script setup lang="ts">
import { computed } from 'vue'

import type { AtButtonProps } from './types'

defineOptions({
  name: 'AtButton',
  inheritAttrs: false,
})

const props = withDefaults(defineProps<AtButtonProps>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
  type: 'button',
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

/** disabled 或 loading 任一成立即不可点击 */
const isDisabled = computed(() => props.disabled || props.loading)

function onClick(event: MouseEvent) {
  if (isDisabled.value) return
  emit('click', event)
}
</script>

<template>
  <button
    v-bind="$attrs"
    class="at-button"
    :class="[`at-button--${variant}`, `at-button--${size}`]"
    :type="type"
    :disabled="isDisabled"
    :aria-busy="loading || undefined"
    @click="onClick"
  >
    <span v-if="loading" class="at-button__spinner" aria-hidden="true" />
    <span class="at-button__content"><slot /></span>
  </button>
</template>

<style>
.at-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--at-space-xs);
  border: 1px solid transparent;
  border-radius: var(--at-radius-md);
  font-weight: 500;
  cursor: pointer;
  user-select: none;
  transition:
    background-color var(--at-duration-fast) var(--at-ease-out),
    border-color var(--at-duration-fast) var(--at-ease-out),
    color var(--at-duration-fast) var(--at-ease-out),
    opacity var(--at-duration-fast) var(--at-ease-out);
}

.at-button:focus-visible {
  outline: 2px solid var(--at-color-primary);
  outline-offset: 2px;
}

/* 尺寸：触控友好 28 / 32 / 40 */
.at-button--sm {
  height: 28px;
  padding: 0 var(--at-space-sm);
  font-size: var(--at-font-sm);
}

.at-button--md {
  height: 32px;
  padding: 0 var(--at-space-md);
  font-size: var(--at-font-base);
}

.at-button--lg {
  height: 40px;
  padding: 0 var(--at-space-lg);
  font-size: var(--at-font-lg);
}

/* 变体 */
.at-button--primary {
  background-color: var(--at-color-primary);
  color: var(--at-color-text-inverse);
}

.at-button--primary:hover:not(:disabled) {
  background-color: color-mix(in srgb, var(--at-color-primary) 88%, black);
}

.at-button--secondary {
  background-color: transparent;
  border-color: var(--at-color-primary);
  color: var(--at-color-primary);
}

.at-button--secondary:hover:not(:disabled),
.at-button--text:hover:not(:disabled) {
  background-color: color-mix(in srgb, var(--at-color-primary) 8%, transparent);
}

.at-button--text {
  background-color: transparent;
  color: var(--at-color-primary);
}

/* 禁用 / 加载（loading 时原生 disabled 同步置位） */
.at-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 加载指示器：尺寸跟随字号，颜色跟随文字色 */
.at-button__spinner {
  width: 1em;
  height: 1em;
  flex: none;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: at-button-spin 0.8s linear infinite;
}

.at-button__content {
  display: inline-flex;
  align-items: center;
}

@keyframes at-button-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
