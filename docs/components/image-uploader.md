<script setup lang="ts">
import { onBeforeUnmount, reactive, ref, type Ref } from 'vue'

import { AtImageUploader } from '../../src/index'
import { formatBytes } from '../../src/utils/image'
import type { UploadItem } from '../../src/components/AtImageUploader/types'

const timers: ReturnType<typeof setInterval>[] = []

onBeforeUnmount(() => {
  timers.forEach((timer) => clearInterval(timer))
})

function makeUpdater(target: Ref<UploadItem[]>) {
  return (uid: string, patch: Partial<UploadItem>) => {
    target.value = target.value.map((item) => (item.uid === uid ? { ...item, ...patch } : item))
  }
}

/** 模拟父组件的真实上传：uploading → done */
function simulateUpload(update: ReturnType<typeof makeUpdater>, item: UploadItem) {
  update(item.uid, { status: 'uploading', progress: 0, message: undefined })
  let progress = 0
  const timer = setInterval(() => {
    progress += 25
    if (progress >= 100) {
      clearInterval(timer)
      update(item.uid, { status: 'done', progress: 100 })
      return
    }
    update(item.uid, { status: 'uploading', progress })
  }, 400)
  timers.push(timer)
}

/* ---------- 示例 1：基础上传 ---------- */

const basicItems = ref<UploadItem[]>([])
const basicUpdate = makeUpdater(basicItems)
const lastError = ref('')

function onBasicUpload(item: UploadItem) {
  lastError.value = ''
  simulateUpload(basicUpdate, item)
}

/* ---------- 示例 2：压缩对比 ---------- */

const rawItems = ref<UploadItem[]>([])
const compressedItems = ref<UploadItem[]>([])
const originalSizes = reactive<Record<string, number>>({})

function onCompressedModel(items: UploadItem[]) {
  for (const item of items) {
    if (originalSizes[item.uid] === undefined) originalSizes[item.uid] = item.size
  }
  compressedItems.value = items
}

/* ---------- 示例 3：错误与重试 ---------- */

function thumb(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="${color}"/><path d="M12 72l20-28 16 22 13-15 19 21z" fill="rgba(255,255,255,0.78)"/><circle cx="70" cy="28" r="8" fill="rgba(255,255,255,0.9)"/></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const stateItems = ref<UploadItem[]>([
  {
    uid: 'demo-done',
    name: 'product-main.jpg',
    size: 842000,
    type: 'image/jpeg',
    status: 'done',
    url: thumb('#2f6bff'),
  },
  {
    uid: 'demo-uploading',
    name: 'product-detail.jpg',
    size: 1520000,
    type: 'image/jpeg',
    status: 'uploading',
    progress: 60,
    url: thumb('#16a34a'),
  },
  {
    uid: 'demo-error',
    name: 'broken.heic',
    size: 2400000,
    type: 'image/heic',
    status: 'error',
    message: '上传失败：网络中断，请重试',
    url: thumb('#dc2626'),
  },
])

const stateUpdate = makeUpdater(stateItems)
const retried = ref(0)

function onStateUpload(item: UploadItem) {
  simulateUpload(stateUpdate, item)
}

function onStateRetry() {
  retried.value += 1
}
</script>

# AtImageUploader 图片上传

`AtImageUploader` 只负责**本地文件与预览**：选择、校验、读取、压缩、缩略图、排序、状态展示。真正的网络请求由父组件完成，组件通过 `upload` 事件把「已就绪的文件」交出去。

## 设计决定：为什么它不接收 FieldDef

本库其他表单组件都消费同一份 `FieldDef[]`，但 `AtImageUploader` 故意**不接收字段协议**：

- **字段协议描述的是「数据」**：`FieldDef` 是 JSON 可序列化的数据描述，可以存库、可以从后端下发、可以在表单渲染器之间流转。
- **上传描述的是「交互过程」**：它包含 `File` / `Blob` 句柄、blob URL、每个文件的进度、失败原因与重试，是有状态、不可序列化的过程数据。
- **混在一起会污染协议**：一旦把文件句柄塞进 `FieldDef`，所有消费字段协议的组件（表格、搜索表单、未来的表单渲染器）都得被迫理解文件对象，协议不再是纯数据。

所以它是本库唯一一个**数据无关**的组件：不关心业务字段叫什么，只通过 `v-model` 接收 `UploadItem[]`，并用事件驱动状态迁移。

## 基础用法

```vue
<AtImageUploader v-model="items" @upload="onUpload" @error="onError" />
```

- 点击或拖拽选择，支持多选；默认最多 6 张、单张 5 MB。
- 选中的文件先过校验，通过后进入列表，状态从 `reading` 走到 `ready`，并 emit `upload`。
- 父组件拿到 `upload` 后自己发请求，再把 `uploading` / `progress` / `done` / `error` 回写到 `modelValue`。

<AtImageUploader
  v-model="basicItems"
  @upload="onBasicUpload"
  @error="lastError = $event.message"
/>

<p v-if="lastError" style="color: #dc2626; font-size: 13px;">校验未通过：{{ lastError }}</p>

```ts
function onUpload(item: UploadItem) {
  // 父组件负责真实上传：先回写 uploading，再按进度回写 progress
  items.value = items.value.map((current) =>
    current.uid === item.uid ? { ...current, status: 'uploading', progress: 0 } : current,
  )
  // …请求完成后回写 done / error
}
```

## 压缩对比：原始体积 vs 压缩后体积

`compress` 默认 `true`，会按 `compressMaxWidth`（默认 1600）等比缩小，并用 `quality`（默认 0.85）重新编码。优先使用 `createImageBitmap(file, { imageOrientation: 'from-image' })` 读取，EXIF 旋转不会丢；环境不支持时回退到 `Image` + canvas；canvas 不可用时跳过压缩，直接使用原文件。

下面左边关闭压缩、右边开启压缩，选同一张大图即可看到体积差异：

<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px;">
  <div>
    <h4 style="margin: 0 0 8px;">未压缩（compress=false）</h4>
    <AtImageUploader
      v-model="rawItems"
      :compress="false"
      :max-size="20 * 1024 * 1024"
    />
  </div>
  <div>
    <h4 style="margin: 0 0 8px;">压缩后（默认配置）</h4>
    <AtImageUploader
      :model-value="compressedItems"
      :max-size="20 * 1024 * 1024"
      @update:model-value="onCompressedModel"
    />
  </div>
</div>

<table v-if="compressedItems.length > 0" style="margin-top: 16px;">
  <thead>
    <tr><th>文件</th><th>原始体积</th><th>压缩后体积</th></tr>
  </thead>
  <tbody>
    <tr v-for="item in compressedItems" :key="item.uid">
      <td>{{ item.name }}</td>
      <td>{{ formatBytes(originalSizes[item.uid] ?? item.size) }}</td>
      <td>{{ formatBytes(item.size) }}</td>
    </tr>
  </tbody>
</table>

原始体积取自第一次 `update:modelValue`（`reading` 状态），压缩后体积是 `ready` 状态里的 `size`——组件在压缩完成后会把 `item.size` 更新为实际产物的体积。

## 错误与重试

两类失败都不会被静默丢弃：

- **校验失败**：类型不符或超过 `maxSize`，直接 emit `error`，**不进入列表**。
- **处理/上传失败**：文件已经进了列表，状态落到 `error` 并带中文 `message`，卡片保留，点「重试」回到 `ready` 并重新 emit `retry` + `upload`。

下面是预置了「已完成 / 上传中 / 失败」三种状态的列表，点失败卡片的「重试」可以看到状态回到 `ready` 后再走一次上传：

<AtImageUploader
  v-model="stateItems"
  @upload="onStateUpload"
  @retry="onStateRetry"
/>

<p style="font-size: 13px; color: #646a73;">已触发重试次数：{{ retried }}</p>

```ts
function onRetry(item: UploadItem) {
  // 组件已经把该项置回 ready；这里只需要重新发起上传
  upload(item)
}
```

## 状态机

每个文件独立，按 `uid` 索引：

```text
选择文件 ──校验失败──▶ error 事件（不入列表）
    │
    ▼
 reading ──读取 + 压缩完成──▶ ready ──父组件回传 uploading──▶ uploading ──▶ done
                                ▲                                  │
                                │                                  │
                                └──────── 重试 ◀── error ◀─────────┘
                                          （上传失败，保留在列表）
```

- **reading**：正在读取与压缩，卡片显示「读取中」
- **ready**：本地就绪，已 emit `upload`，等待父组件上传
- **uploading**：父组件回写 `status: 'uploading'`，按 `progress` 渲染进度条
- **done**：父组件回写成功
- **error**：校验失败或上传失败，带中英文案 `message`，可重试

迁移只能由事件驱动：选文件 → `reading` → `ready`；父组件回传 `uploading` / `done` / `error`；重试 → `ready`。**组件不修改 `props.modelValue`**，所有变更都通过 `update:modelValue` 交还父组件。

## API

### Props

| 属性 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| modelValue | 上传项列表，由父组件持有 | `UploadItem[]` | 必填 |
| maxCount | 最多几张，达到后隐藏上传区 | `number` | `6` |
| maxSize | 单张体积上限（字节） | `number` | `5 * 1024 * 1024` |
| accept | 允许的文件类型，支持 `image/*` 与逗号列表 | `string` | `'image/*'` |
| compress | 是否本地压缩 | `boolean` | `true` |
| compressMaxWidth | 压缩后的最大宽度 | `number` | `1600` |
| quality | 重新编码质量，0 - 1 | `number` | `0.85` |
| disabled | 禁用选择、删除、重试与排序 | `boolean` | `false` |
| sortable | 是否允许排序 | `boolean` | `true` |

### Emits

| 事件 | 说明 | 参数 |
| --- | --- | --- |
| update:modelValue | 列表变化，父组件用 `v-model` 接收 | `UploadItem[]` |
| upload | 本地已就绪，请父组件上传 | `UploadItem` |
| remove | 删除某项 | `UploadItem` |
| retry | 某项被重置为 `ready`，请重新上传 | `UploadItem` |
| error | 校验、读取或上传失败 | `{ item, message }` |

### 类型

```ts
type UploadStatus = 'reading' | 'ready' | 'uploading' | 'done' | 'error'

interface UploadItem {
  uid: string
  name: string
  size: number
  type: string
  status: UploadStatus
  url?: string        // 本地 blob URL，用于缩略图
  progress?: number   // 0 - 100，uploading 时展示
  message?: string    // error 时的中文原因
}
```

## 行为与可访问性

- **选择**：点击上传区或把文件拖进上传区；支持多选；达到 `maxCount` 后上传区隐藏。
- **卡片**：缩略图、文件名、`formatBytes` 后的体积、状态角标、`uploading` 时的进度条、`error` 时的原因文案。
- **删除**：点 ×，emit `remove` 并同步 `update:modelValue`。
- **排序**：HTML5 拖拽，外加每张卡片的上移/下移按钮；按钮有 `aria-label`，键盘可达。
- **键盘**：上传区 `tabindex=0`，Enter / Space 触发文件选择；拖拽区有 `aria-label`。
- **播报**：状态变化写入 `aria-live="polite"` 区域，读屏可感知「读取中 / 已就绪 / 失败原因」。
- **样式**：只使用 `--at-*` 设计 token。

## 已知限制

- **不做裁剪**：Canvas 裁剪（固定比例裁剪框）进入 ROADMAP，本轮只做等比缩放压缩。
- **不做分片 / 断点续传**：组件不发起任何网络请求，分片与续传属于父组件的上传策略。
- **不做真实上传**：`upload` 只是「本地就绪」的信号，父组件负责请求、鉴权、进度回写与失败重试。
- **压缩配置是全局的**：同一次选择的所有文件共享 `compress` / `compressMaxWidth` / `quality`，不支持逐文件配置。
- **排序只改数组顺序**：组件不持久化顺序，需要保存时由父组件在 `update:modelValue` 里处理。
