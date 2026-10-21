<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { checkFile, computeTargetSize, formatBytes } from '../../utils/image'
import type { AtImageUploaderProps, UploadItem, UploadStatus } from './types'

defineOptions({
  name: 'AtImageUploader',
})

const props = withDefaults(defineProps<AtImageUploaderProps>(), {
  maxCount: 6,
  maxSize: 5 * 1024 * 1024,
  accept: 'image/*',
  compress: true,
  compressMaxWidth: 1600,
  quality: 0.85,
  disabled: false,
  sortable: true,
})

const emit = defineEmits<{
  'update:modelValue': [items: UploadItem[]]
  upload: [item: UploadItem]
  remove: [item: UploadItem]
  retry: [item: UploadItem]
  error: [payload: { item: UploadItem; message: string }]
}>()

const STATUS_TEXT: Record<UploadStatus, string> = {
  reading: '读取中',
  ready: '待上传',
  uploading: '上传中',
  done: '已完成',
  error: '失败',
}

/* ---------- 本地列表（只读 props.modelValue，改动一律 emit） ---------- */

const items = ref<UploadItem[]>([])

/** 组件自己创建的 blob URL，只有这里面的地址才允许 revoke */
const ownedUrls = new Set<string>()

function sameItem(a: UploadItem, b: UploadItem): boolean {
  return (
    a.uid === b.uid &&
    a.name === b.name &&
    a.size === b.size &&
    a.type === b.type &&
    a.status === b.status &&
    a.url === b.url &&
    a.progress === b.progress &&
    a.message === b.message
  )
}

function sameItems(a: UploadItem[], b: UploadItem[]): boolean {
  return a.length === b.length && a.every((item, index) => sameItem(item, b[index]))
}

watch(
  () => props.modelValue,
  (value) => {
    const incoming = Array.isArray(value) ? value : []
    if (sameItems(incoming, items.value)) return

    // 父组件清空或重置列表时，回收已经不在列表里的 blob URL
    const keptUrls = new Set<string>()
    for (const item of incoming) {
      if (item.url) keptUrls.add(item.url)
    }
    for (const item of items.value) {
      if (item.url && !keptUrls.has(item.url)) releaseUrl(item.url)
    }

    items.value = incoming.map((item) => ({ ...item }))
  },
  { immediate: true, deep: true },
)

function commit(next: UploadItem[]) {
  items.value = next
  emit(
    'update:modelValue',
    next.map((item) => ({ ...item })),
  )
}

function patchItem(uid: string, patch: Partial<UploadItem>): UploadItem | undefined {
  if (!items.value.some((item) => item.uid === uid)) return undefined
  const next: UploadItem[] = items.value.map((item) =>
    item.uid === uid ? { ...item, ...patch } : item,
  )
  commit(next)
  return next.find((item) => item.uid === uid)
}

/* ---------- 校验与选择 ---------- */

const inputRef = ref<HTMLInputElement | null>(null)
const dragging = ref(false)
const liveMessage = ref('')
const maxSizeText = computed(() => formatBytes(props.maxSize))
const atLimit = computed(() => items.value.length >= props.maxCount)

let uidSeed = 0

function createUid(): string {
  uidSeed += 1
  return `at-image-${Date.now().toString(36)}-${uidSeed}`
}

function handleFiles(files: File[]) {
  for (const file of files) {
    if (items.value.length >= props.maxCount) break

    const checked = checkFile(file, { accept: props.accept, maxSize: props.maxSize })
    const base: UploadItem = {
      uid: createUid(),
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'reading',
    }

    if (!checked.ok) {
      const message = checked.message ?? '文件校验失败'
      liveMessage.value = `${file.name}：${message}`
      emit('error', { item: { ...base, status: 'error', message }, message })
      continue
    }

    commit([...items.value, base])
    void processFile(file, base.uid)
  }
}

function openPicker() {
  if (props.disabled || atLimit.value) return
  inputRef.value?.click()
}

function onInputChange(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  handleFiles(files)
  input.value = ''
}

function onDropzoneKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  openPicker()
}

function onDragOver() {
  if (props.disabled) return
  dragging.value = true
}

function onDragLeave() {
  dragging.value = false
}

function onDrop(event: DragEvent) {
  dragging.value = false
  if (props.disabled) return
  handleFiles(Array.from(event.dataTransfer?.files ?? []))
}

/* ---------- 读取与压缩 ---------- */

function createObjectUrl(blob: Blob): string {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return ''
  try {
    const url = URL.createObjectURL(blob)
    ownedUrls.add(url)
    return url
  } catch {
    return ''
  }
}

/** 只回收本组件创建的 blob URL，父组件传入的 https 地址一律不碰 */
function releaseUrl(url?: string) {
  if (!url || !url.startsWith('blob:')) return
  if (!ownedUrls.has(url)) return

  ownedUrls.delete(url)
  if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url)
  }
}

function createCanvas(width: number, height: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (typeof canvas.toBlob !== 'function') {
      resolve(null)
      return
    }
    canvas.toBlob((blob) => resolve(blob), type || 'image/jpeg', quality)
  })
}

async function compressWithBitmap(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const target = computeTargetSize({
      width: bitmap.width,
      height: bitmap.height,
      maxWidth: props.compressMaxWidth,
    })
    if (target.width === bitmap.width && target.height === bitmap.height) return file

    const canvas = createCanvas(target.width, target.height)
    if (!canvas) return file
    const context = canvas.getContext('2d')
    if (!context) return file

    context.drawImage(bitmap, 0, 0, target.width, target.height)
    return (await canvasToBlob(canvas, file.type, props.quality)) ?? file
  } finally {
    bitmap.close()
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined') {
      reject(new Error('当前环境不支持图片解码'))
      return
    }
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片解码失败'))
    image.src = url
  })
}

async function compressWithImageElement(file: File): Promise<Blob> {
  const url = createObjectUrl(file)
  // 拿不到 blob url 说明环境不支持解码预览，直接跳过压缩
  if (!url) return file

  try {
    const image = await loadImage(url)
    const width = image.naturalWidth || image.width
    const height = image.naturalHeight || image.height
    const target = computeTargetSize({ width, height, maxWidth: props.compressMaxWidth })

    if (target.width === width && target.height === height) return file

    const canvas = createCanvas(target.width, target.height)
    if (!canvas) return file
    const context = canvas.getContext('2d')
    if (!context) return file

    context.drawImage(image, 0, 0, target.width, target.height)
    return (await canvasToBlob(canvas, file.type, props.quality)) ?? file
  } finally {
    releaseUrl(url)
  }
}

async function prepareImage(file: File): Promise<Blob> {
  if (!props.compress) return file

  if (typeof createImageBitmap === 'function') {
    try {
      return await compressWithBitmap(file)
    } catch {
      // 继续走 Image + canvas 回退
    }
  }

  try {
    return await compressWithImageElement(file)
  } catch {
    return file
  }
}

async function processFile(file: File, uid: string) {
  liveMessage.value = `${file.name} 正在读取`

  try {
    const processed = await prepareImage(file)
    const url = createObjectUrl(processed)
    const ready = patchItem(uid, {
      size: processed.size,
      status: 'ready',
      url: url || undefined,
    })
    if (!ready) return

    liveMessage.value = `${ready.name} 已就绪，等待上传`
    emit('upload', { ...ready })
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : '图片处理失败'
    failItem(uid, message)
  }
}

function failItem(uid: string, message: string) {
  const failed = patchItem(uid, { status: 'error', message })
  if (!failed) return
  liveMessage.value = `${failed.name}：${message}`
  emit('error', { item: { ...failed }, message })
}

/* ---------- 删除、重试、排序 ---------- */

function removeItem(item: UploadItem) {
  if (props.disabled) return
  releaseUrl(item.url)
  commit(items.value.filter((current) => current.uid !== item.uid))
  liveMessage.value = `${item.name} 已移除`
  emit('remove', { ...item })
}

function retryItem(item: UploadItem) {
  if (props.disabled) return
  const ready = patchItem(item.uid, { status: 'ready', message: undefined, progress: undefined })
  if (!ready) return

  liveMessage.value = `${ready.name} 已重置为待上传`
  emit('retry', { ...ready })
  emit('upload', { ...ready })
}

function moveItem(from: number, to: number) {
  if (props.disabled) return
  if (from === to) return
  if (from < 0 || to < 0 || from >= items.value.length || to >= items.value.length) return

  const next = [...items.value]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  commit(next)
}

const dragIndex = ref<number | null>(null)

function onItemDragStart(index: number, event: DragEvent) {
  if (!props.sortable || props.disabled) return
  dragIndex.value = index
  event.dataTransfer?.setData('text/plain', String(index))
}

function onItemDrop(index: number) {
  if (dragIndex.value === null) return
  moveItem(dragIndex.value, index)
  dragIndex.value = null
}

function onItemDragEnd() {
  dragIndex.value = null
}

function statusText(status: UploadStatus): string {
  return STATUS_TEXT[status]
}

onBeforeUnmount(() => {
  for (const url of ownedUrls) releaseUrl(url)
  ownedUrls.clear()
})
</script>

<template>
  <div class="at-image-uploader" :class="{ 'at-image-uploader--disabled': disabled }">
    <div
      v-if="!atLimit"
      class="at-image-uploader__dropzone"
      :class="{ 'at-image-uploader__dropzone--dragging': dragging }"
      role="button"
      :tabindex="disabled ? -1 : 0"
      :aria-disabled="disabled || undefined"
      aria-label="点击或拖拽图片到此处上传"
      @click="openPicker"
      @keydown="onDropzoneKeydown"
      @dragover.prevent="onDragOver"
      @dragleave="onDragLeave"
      @drop.prevent="onDrop"
    >
      <input
        ref="inputRef"
        class="at-image-uploader__input"
        type="file"
        :accept="accept"
        multiple
        :disabled="disabled"
        @change="onInputChange"
      />
      <span class="at-image-uploader__dropzone-title">点击或拖拽图片到此处</span>
      <span class="at-image-uploader__dropzone-hint">
        {{ accept }} · 最多 {{ maxCount }} 张 · 单张不超过 {{ maxSizeText }}
      </span>
    </div>

    <ul v-if="items.length > 0" class="at-image-uploader__list">
      <li
        v-for="(item, index) in items"
        :key="item.uid"
        class="at-image-uploader__item"
        :class="`at-image-uploader__item--${item.status}`"
        :draggable="sortable && !disabled"
        @dragstart="onItemDragStart(index, $event)"
        @dragover.prevent
        @drop.prevent="onItemDrop(index)"
        @dragend="onItemDragEnd"
      >
        <div class="at-image-uploader__thumb">
          <img v-if="item.url" :src="item.url" :alt="item.name" />
          <span v-else class="at-image-uploader__thumb-placeholder">图片</span>
        </div>

        <div class="at-image-uploader__meta">
          <span class="at-image-uploader__name" :title="item.name">{{ item.name }}</span>
          <span class="at-image-uploader__size">{{ formatBytes(item.size) }}</span>
          <span
            class="at-image-uploader__status"
            :class="`at-image-uploader__status--${item.status}`"
          >
            {{ statusText(item.status) }}
          </span>
          <span v-if="item.status === 'error' && item.message" class="at-image-uploader__message">
            {{ item.message }}
          </span>
          <span
            v-if="item.status === 'uploading'"
            class="at-image-uploader__progress"
            role="progressbar"
            :aria-valuenow="item.progress ?? 0"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <span
              class="at-image-uploader__progress-bar"
              :style="{ width: `${item.progress ?? 0}%` }"
            />
          </span>
        </div>

        <div class="at-image-uploader__actions">
          <template v-if="sortable">
            <button
              type="button"
              class="at-image-uploader__move"
              aria-label="上移"
              :disabled="disabled || index === 0"
              @click="moveItem(index, index - 1)"
            >
              ↑
            </button>
            <button
              type="button"
              class="at-image-uploader__move"
              aria-label="下移"
              :disabled="disabled || index === items.length - 1"
              @click="moveItem(index, index + 1)"
            >
              ↓
            </button>
          </template>
          <button
            v-if="item.status === 'error'"
            type="button"
            class="at-image-uploader__retry"
            :disabled="disabled"
            @click="retryItem(item)"
          >
            重试
          </button>
          <button
            type="button"
            class="at-image-uploader__remove"
            :aria-label="`删除 ${item.name}`"
            :disabled="disabled"
            @click="removeItem(item)"
          >
            ×
          </button>
        </div>
      </li>
    </ul>

    <span class="at-image-uploader__live" aria-live="polite">{{ liveMessage }}</span>
  </div>
</template>

<style>
.at-image-uploader {
  display: flex;
  flex-direction: column;
  gap: var(--at-space-sm);
  font-size: var(--at-font-base);
  line-height: var(--at-line-height);
  color: var(--at-color-text-1);
}

.at-image-uploader__dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--at-space-xs);
  min-height: calc(var(--at-space-xl) * 3);
  padding: var(--at-space-md);
  border: 1px dashed var(--at-color-border);
  border-radius: var(--at-radius-md);
  background-color: var(--at-color-bg-subtle);
  color: var(--at-color-text-2);
  cursor: pointer;
  transition:
    border-color var(--at-duration-fast) var(--at-ease-out),
    background-color var(--at-duration-fast) var(--at-ease-out);
}

.at-image-uploader__dropzone:hover:not(.at-image-uploader--disabled .at-image-uploader__dropzone) {
  border-color: var(--at-color-primary);
  color: var(--at-color-primary);
}

.at-image-uploader__dropzone:focus-visible {
  outline: 2px solid var(--at-color-ring);
  outline-offset: 1px;
  border-color: var(--at-color-primary);
}

.at-image-uploader__dropzone--dragging {
  border-color: var(--at-color-primary);
  background-color: var(--at-color-fill-hover);
  color: var(--at-color-primary);
}

.at-image-uploader__input {
  display: none;
}

.at-image-uploader__dropzone-title {
  font-size: var(--at-font-base);
}

.at-image-uploader__dropzone-hint {
  color: var(--at-color-text-3);
  font-size: var(--at-font-sm);
}

.at-image-uploader__list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--at-space-sm);
  margin: 0;
  padding: 0;
  list-style: none;
}

.at-image-uploader__item {
  display: flex;
  align-items: flex-start;
  gap: var(--at-space-sm);
  padding: var(--at-space-sm);
  border: 1px solid var(--at-color-border);
  border-radius: var(--at-radius-md);
  background-color: var(--at-color-bg);
}

.at-image-uploader__item--error {
  border-color: var(--at-color-danger);
}

.at-image-uploader__thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: calc(var(--at-space-xl) * 2);
  height: calc(var(--at-space-xl) * 2);
  overflow: hidden;
  border-radius: var(--at-radius-sm);
  background-color: var(--at-color-bg-subtle);
}

.at-image-uploader__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.at-image-uploader__thumb-placeholder {
  color: var(--at-color-text-3);
  font-size: var(--at-font-sm);
}

.at-image-uploader__meta {
  display: flex;
  flex-direction: column;
  gap: var(--at-space-xs);
  flex: 1;
  min-width: 0;
}

.at-image-uploader__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--at-color-text-1);
}

.at-image-uploader__size {
  color: var(--at-color-text-3);
  font-size: var(--at-font-sm);
}

.at-image-uploader__status {
  font-size: var(--at-font-sm);
}

.at-image-uploader__status--reading {
  color: var(--at-color-text-2);
}

.at-image-uploader__status--ready {
  color: var(--at-color-primary);
}

.at-image-uploader__status--uploading {
  color: var(--at-color-warning);
}

.at-image-uploader__status--done {
  color: var(--at-color-success);
}

.at-image-uploader__status--error {
  color: var(--at-color-danger);
}

.at-image-uploader__message {
  color: var(--at-color-danger);
  font-size: var(--at-font-sm);
}

.at-image-uploader__progress {
  display: block;
  height: var(--at-space-xs);
  overflow: hidden;
  border-radius: var(--at-radius-sm);
  background-color: var(--at-color-fill-hover);
}

.at-image-uploader__progress-bar {
  display: block;
  height: 100%;
  border-radius: var(--at-radius-sm);
  background-color: var(--at-color-primary);
  transition: width var(--at-duration-fast) var(--at-ease-out);
}

.at-image-uploader__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--at-space-xs);
  flex: 0 0 auto;
}

.at-image-uploader__actions button {
  min-width: var(--at-space-lg);
  height: var(--at-space-lg);
  padding: 0 var(--at-space-xs);
  border: 1px solid var(--at-color-border);
  border-radius: var(--at-radius-sm);
  background-color: var(--at-color-bg);
  color: var(--at-color-text-2);
  font-size: var(--at-font-sm);
  line-height: 1;
  cursor: pointer;
}

.at-image-uploader__actions button:hover:not(:disabled) {
  border-color: var(--at-color-primary);
  color: var(--at-color-primary);
}

.at-image-uploader__actions button:focus-visible {
  outline: 2px solid var(--at-color-ring);
  outline-offset: 1px;
}

.at-image-uploader__actions button:disabled {
  color: var(--at-color-text-3);
  cursor: not-allowed;
}

.at-image-uploader__retry {
  color: var(--at-color-danger);
}

.at-image-uploader__live {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
