<script setup lang="ts">
import { computed, ref } from 'vue'

import { AtProTable, AtSearchForm } from '../../src/index'
import type { AtSearchFormSearchPayload } from '../../src/components/AtSearchForm/types'
import { orderFields } from '../../tests/fixtures/order-fields'

const rows: Record<string, unknown>[] = [
  { id: 1, orderNo: 'AT20261021001', createdAt: '2026-10-21 10:00', customerName: '张三', itemCount: 3, amount: 1299.5, paymentMethod: 'wechat', status: 'shipped', urgent: true, remark: '尽快发货' },
  { id: 2, orderNo: 'AT20261021002', createdAt: '2026-10-21 11:00', customerName: '李四', itemCount: 1, amount: 99, paymentMethod: 'alipay', status: 'pending', urgent: false, remark: '' },
  { id: 3, orderNo: 'AT20261021003', createdAt: '2026-10-21 12:30', customerName: '王五', itemCount: 8, amount: 5680, paymentMethod: 'bankcard', status: 'completed', urgent: false, remark: '需要发票' },
  { id: 4, orderNo: 'AT20261021004', createdAt: '2026-10-21 13:15', customerName: '赵六', itemCount: 2, amount: 358, paymentMethod: 'wechat', status: 'cancelled', urgent: true, remark: '客户取消' },
  { id: 5, orderNo: 'AT20261021005', createdAt: '2026-10-21 14:20', customerName: '孙七', itemCount: 5, amount: 2460, paymentMethod: 'alipay', status: 'shipped', urgent: false, remark: '' },
  { id: 6, orderNo: 'AT20261021006', createdAt: '2026-10-21 15:05', customerName: '周八', itemCount: 1, amount: 128, paymentMethod: 'wechat', status: 'pending', urgent: false, remark: '工作日送达' },
]

const model = ref<Record<string, unknown>>({})
const applied = ref<Record<string, unknown>>({})

function apply(values: Record<string, unknown>) {
  applied.value = values
}

function onSearch(payload: AtSearchFormSearchPayload) {
  apply(payload.values)
}

function onReset(payload: AtSearchFormSearchPayload) {
  apply(payload.values)
}

/** 仅用于演示：业务方拿到 conditions 后自行请求接口，这里做本地过滤 */
const filteredRows = computed(() =>
  rows.filter((row) =>
    Object.entries(applied.value).every(([key, value]) => {
      if (Array.isArray(value)) return value.length === 0 || value.includes(row[key])
      if (typeof value === 'string') return String(row[key] ?? '').includes(value)
      return row[key] === value
    }),
  ),
)
</script>

# AtSearchForm 查询表单

## 一份 orderFields 同时驱动搜索区与表格

搜索与表格共用同一个 `FieldDef[]`，不存在第二套配置类型。下面这段代码里，`orderFields` 同一个变量同时传给了两个组件：

```vue
<AtSearchForm :fields="orderFields" />
<AtProTable :fields="orderFields" :data="rows" />
```

输入「客户名」后点查询或直接回车，表格会按条件过滤；重置会恢复各字段的 `getDefaultValue`。

<AtSearchForm
  :fields="orderFields"
  :model-value="model"
  @update:model-value="model = $event"
  @search="onSearch"
  @reset="onReset"
/>

<AtProTable
  :fields="orderFields"
  :data="filteredRows"
  row-key="id"
  :total="filteredRows.length"
/>

## 条件映射

查询按钮派发 `search({ values, conditions })`，`conditions` 按字段类型映射为已冻结的 `SearchOperator`：

| 字段 type | 控件 | operator | 说明 |
| --- | --- | --- | --- |
| text | input | `like` | 模糊匹配 |
| number | input[type=number] | `eq` | 精确匹配 |
| select（单选） | select | `eq` | 枚举单值 |
| select（多选） | select[multiple] | `in` | 枚举多值 |
| date（单选） | input[type=date] | `eq` | 单日 |
| date（范围） | 两个 date | `between` | `[start, end]` |
| boolean | select | `eq` | `true` / `false` |
| custom | 不渲染 | — | 不参与搜索 |

空值（`''`、`undefined`、`null`、空数组）的字段既不进入 `values` 也不进入 `conditions`；`false` 是有效布尔值，不会被当作空值。

> 布尔字段的初始值与重置值使用 `''`（全部），而不是 `getDefaultValue` 的 `false`。原因见 [表单语义 vs 搜索语义](../schema#表单语义-vs-搜索语义)。

## 可见性与布局

- 只渲染 `isSearchable(field)` 为 `true` 的字段（复用字段协议里的同一函数）
- `columns` 默认 3；容器变窄时自动降为 2 列 / 1 列
- `collapsible` 默认开启：可搜索字段数超过 `columns * 2` 时，默认只显示前 `columns * 2` 个，其余折叠

## API

### Props

| 属性 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| fields | 与 AtProTable 共用的字段协议 | `FieldDef[]` | 必填 |
| modelValue | 表单值（受控） | `Record<string, unknown>` | — |
| columns | 每行列数 | `number` | `3` |
| collapsible | 字段过多时是否折叠 | `boolean` | `true` |
| loading | 查询中，禁用查询按钮 | `boolean` | `false` |

### Emits

| 事件 | 说明 | 参数 |
| --- | --- | --- |
| update:modelValue | 任一字段变化 / 重置后的完整值 | `values: Record<string, unknown>` |
| search | 点击查询或在输入框回车 | `{ values, conditions }` |
| reset | 点击重置，值已恢复默认 | `{ values, conditions }` |

### Slots

| 插槽 | 说明 | 作用域 |
| --- | --- | --- |
| actions | 替换默认的「查询 / 重置」按钮 | — |

> 架构约束：`AtSearchForm` 的 props 只有 `fields: FieldDef[]` 这一份字段来源。禁止出现 `SearchFieldSchema`、`filterConfig`、`searchProps` 之类"搜索专用"的第二套配置。
