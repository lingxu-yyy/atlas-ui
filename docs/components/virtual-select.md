<script setup lang="ts">
import { ref } from 'vue'

import { AtVirtualSelect } from '../../src/index'
import type { SelectField } from '../../src/types/schema'

const products: SelectField = {
  key: 'product',
  label: '商品',
  type: 'select',
  options: Array.from({ length: 10000 }, (_, index) => ({
    label: `商品 ${index + 1}`,
    value: index + 1,
  })),
}

const single = ref<unknown>()

const multiField: SelectField = {
  ...products,
  key: 'products',
  label: '商品（多选）',
  multiple: true,
  filterable: true,
}

const multi = ref<unknown[]>([])

const remoteField: SelectField = {
  key: 'remoteProduct',
  label: '远程商品',
  type: 'select',
  filterable: true,
  loadOptions: async () => {
    await new Promise((resolve) => setTimeout(resolve, 300))
    return Array.from({ length: 200 }, (_, index) => ({
      label: `远程商品 ${index + 1}`,
      value: `remote-${index + 1}`,
    }))
  },
}

const remote = ref<unknown>()
const keyword = ref('')
</script>

# AtVirtualSelect 虚拟滚动选择器

数据量大到一万条时，普通的下拉框会把一万个 DOM 节点一次性铺进页面，打开就卡。`AtVirtualSelect` 用**固定行高 + 区间渲染**解决这个问题：DOM 里始终只有可视区附近的十几个节点。

它只消费字段协议里的 `select` 字段，没有第二套配置。

## 一万条商品：基础用法

```vue
<AtVirtualSelect v-model="single" :field="products" />
```

`products.options` 有 10000 条，打开面板后滚动——滚动条按真实总高度走，但 DOM 里同时存在的 `role="option"` 节点不超过 40 个。

<AtVirtualSelect v-model="single" :field="products" />

已选值：`{{ single ?? '未选择' }}`

## 多选与本地过滤

`field.multiple` 打开多选，选中项以 tag 展示；`field.filterable` 打开搜索框，本地按 `label` 不区分大小写包含匹配。

```vue
<AtVirtualSelect v-model="multi" :field="multiField" />
```

<AtVirtualSelect v-model="multi" :field="multiField" />

已选值：`{{ multi }}`

组件是受控的：点击选项或 × 只 emit `update:modelValue`，选中状态由父组件的 `v-model` 回流。

## 远程搜索

同时存在 `loadOptions` 且 `filterable: true` 时走远程：打开面板或输入关键词会调用 `loadOptions()`，300ms 防抖，加载期间显示「加载中…」。

```vue
<AtVirtualSelect v-model="remote" :field="remoteField" @search="keyword = $event" />
```

<AtVirtualSelect
  v-model="remote"
  :field="remoteField"
  @search="keyword = $event"
/>

search 关键词：`{{ keyword || '（空）' }}`

`loadOptions` 的签名是 `() => Promise<FieldOption[]>`，不带参数；关键词通过 `search` 事件交给父组件，由父组件决定如何请求，组件不假设任何后端协议。

## API

### Props

| 属性 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| field | 字段定义，`type` 必须为 `select` | `SelectField` | 必填 |
| modelValue | 当前选中值；`multiple` 时为数组 | `unknown` | — |
| placeholder | 未选择时的占位文案 | `string` | `'请选择'` |
| disabled | 禁用整个选择器 | `boolean` | `false` |
| itemHeight | 固定行高，虚拟滚动的前提 | `number` | `32` |
| overscan | 可视区上下各多渲染几行 | `number` | `4` |
| maxVisibleItems | 可视区能容纳的行数，决定浮层高度 | `number` | `8` |

### Emits

| 事件 | 说明 | 参数 |
| --- | --- | --- |
| update:modelValue | 选中 / 取消选中 | `value: unknown` |
| search | 远程模式下关键词变化，便于父组件接管请求 | `keyword: string` |

### Slots

| 插槽 | 说明 | scope |
| --- | --- | --- |
| option | 自定义选项内容 | `{ option, index, selected }` |

## 键盘快捷键

| 按键 | 行为 |
| --- | --- |
| ↑ / ↓ | 移动高亮项；面板关闭时按 ↓ 打开 |
| Enter | 选中高亮项 |
| Esc | 关闭面板，不改变已选值 |
| Home / End | 跳到首项 / 末项 |
| Tab | 关闭面板并正常移出焦点 |
| Backspace | 多选且搜索框为空时，删除最后一个 tag |

## 性能说明：为什么一万条不卡

1. **固定行高**：`itemHeight` 恒定，任意下标的位置就是 `index * itemHeight`，不需要测量。
2. **撑高 + 切片**：列表内部只有一个高度为 `total * itemHeight` 的占位元素撑出真实滚动条，真正渲染的只有 `[start, end)` 这一段，容器用 `translateY(offsetY)` 放到正确位置。
3. **区间公式**：`getVisibleRange` 是纯函数，输入 `scrollTop / viewportHeight / itemHeight / total / overscan`，输出 `{ start, end, offsetY, totalHeight }`。滚动只更新一个数字，Vue 只重渲染切片。

同时存在的 option 节点数上限约为 `maxVisibleItems + 2 * overscan + 1`：默认配置下为 17 个，远低于常用的 40 个阈值。

浮层定位同样不依赖任何第三方库：内部 `usePopover` 只做 `position: fixed` + Teleport 到 body，默认向下、空间不足且上方更大时向上翻转，监听 window 的 scroll（rAF 节流）与 resize。

## 已知限制

- **固定行高**：选项高度必须一致；需要多行文本时请自增高 `itemHeight`，不支持逐项测量。
- **不支持分组虚拟化**：没有 option group，需要分组请用普通列表或自行组合。
- **不做滚动容器跟随**：浮层随 window 滚动更新位置，不会跟随任意父级滚动容器。
- **远程搜索不做本地过滤**：走远程时列表内容完全由 `loadOptions()` 返回，组件只负责展示与防抖。
