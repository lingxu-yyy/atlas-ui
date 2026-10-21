<script setup lang="ts">
import { computed } from 'vue'

defineOptions({
  name: 'AtProPager',
})

const props = withDefaults(
  defineProps<{
    page: number
    pageSize: number
    total: number
    pageSizes?: number[]
  }>(),
  {
    pageSizes: () => [10, 20, 50, 100],
  },
)

const emit = defineEmits<{
  'update:page': [page: number]
  'update:pageSize': [size: number]
}>()

const pageCount = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))

/** 页数过多时折叠中间页码，保留首页末页与当前页邻域 */
const pageItems = computed<(number | '...')[]>(() => {
  const count = pageCount.value
  if (count <= 7) return Array.from({ length: count }, (_, index) => index + 1)

  const current = props.page
  const items: (number | '...')[] = [1]
  if (current > 3) items.push('...')

  const start = Math.max(2, current - 1)
  const end = Math.min(count - 1, current + 1)
  for (let index = start; index <= end; index += 1) items.push(index)

  if (current < count - 2) items.push('...')
  items.push(count)
  return items
})

function go(page: number) {
  if (page < 1 || page > pageCount.value || page === props.page) return
  emit('update:page', page)
}

function onSizeChange(event: Event) {
  const size = Number((event.target as HTMLSelectElement).value)
  if (size === props.pageSize) return
  emit('update:pageSize', size)
}
</script>

<template>
  <nav class="at-pro-pager" aria-label="分页导航">
    <span class="at-pro-pager__total">共 {{ total }} 条</span>

    <button
      type="button"
      class="at-pro-pager__btn"
      :disabled="page <= 1"
      aria-label="上一页"
      @click="go(page - 1)"
    >
      上一页
    </button>

    <template v-for="(item, index) in pageItems" :key="index">
      <span v-if="item === '...'" class="at-pro-pager__ellipsis" aria-hidden="true">…</span>
      <button
        v-else
        type="button"
        class="at-pro-pager__btn"
        :class="{ 'at-pro-pager__btn--active': item === page }"
        :aria-current="item === page ? 'page' : undefined"
        @click="go(item)"
      >
        {{ item }}
      </button>
    </template>

    <button
      type="button"
      class="at-pro-pager__btn"
      :disabled="page >= pageCount"
      aria-label="下一页"
      @click="go(page + 1)"
    >
      下一页
    </button>

    <label class="at-pro-pager__size">
      <span class="at-pro-pager__size-text">每页</span>
      <select class="at-pro-pager__select" :value="pageSize" @change="onSizeChange">
        <option v-for="size in pageSizes" :key="size" :value="size">{{ size }} 条</option>
      </select>
    </label>
  </nav>
</template>

<style>
.at-pro-pager {
  display: flex;
  align-items: center;
  gap: var(--at-space-xs);
  padding: var(--at-space-sm) var(--at-space-md);
  font-size: var(--at-font-sm);
  color: var(--at-color-text-2);
  line-height: var(--at-line-height);
}

.at-pro-pager__total {
  margin-right: auto;
  color: var(--at-color-text-2);
}

.at-pro-pager__btn {
  min-width: var(--at-space-xl);
  height: var(--at-space-xl);
  padding: 0 var(--at-space-sm);
  border: 1px solid var(--at-color-border);
  border-radius: var(--at-radius-sm);
  background-color: var(--at-color-bg);
  color: var(--at-color-text-1);
  font-size: var(--at-font-sm);
  cursor: pointer;
  transition: background-color var(--at-duration-fast) var(--at-ease-out);
}

.at-pro-pager__btn:hover:not(:disabled) {
  background-color: var(--at-color-fill-hover);
}

.at-pro-pager__btn:focus-visible {
  outline: 2px solid var(--at-color-primary);
  outline-offset: 2px;
}

.at-pro-pager__btn--active {
  border-color: var(--at-color-primary);
  background-color: var(--at-color-primary);
  color: var(--at-color-text-inverse);
}

.at-pro-pager__btn--active:hover:not(:disabled) {
  background-color: var(--at-color-primary-hover);
}

.at-pro-pager__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.at-pro-pager__ellipsis {
  padding: 0 var(--at-space-xs);
  color: var(--at-color-text-3);
}

.at-pro-pager__size {
  display: inline-flex;
  align-items: center;
  gap: var(--at-space-xs);
  margin-left: var(--at-space-sm);
}

.at-pro-pager__size-text {
  color: var(--at-color-text-2);
}

.at-pro-pager__select {
  height: var(--at-space-xl);
  padding: 0 var(--at-space-xs);
  border: 1px solid var(--at-color-border);
  border-radius: var(--at-radius-sm);
  background-color: var(--at-color-bg);
  color: var(--at-color-text-1);
  font-size: var(--at-font-sm);
  cursor: pointer;
}

.at-pro-pager__select:focus-visible {
  outline: 2px solid var(--at-color-primary);
  outline-offset: 2px;
}
</style>
