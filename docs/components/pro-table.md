<script setup lang="ts">
import { computed, ref } from 'vue'

import { AtProTable } from '../../src/index'
import { orderFields } from '../../tests/fixtures/order-fields'

const rows: Record<string, unknown>[] = [
  {
    id: 1,
    orderNo: 'AT20261021001',
    createdAt: '2026-10-21 10:00',
    customerName: '张三',
    itemCount: 3,
    amount: 1299.5,
    paymentMethod: 'wechat',
    status: 'shipped',
    urgent: true,
    remark: '尽快发货',
  },
  {
    id: 2,
    orderNo: 'AT20261021002',
    createdAt: '2026-10-21 11:00',
    customerName: '李四',
    itemCount: 1,
    amount: 99,
    paymentMethod: 'alipay',
    status: 'pending',
    urgent: false,
    remark: '',
  },
  {
    id: 3,
    orderNo: 'AT20261021003',
    createdAt: '2026-10-21 12:30',
    customerName: '王五',
    itemCount: 8,
    amount: 5680,
    paymentMethod: 'bankcard',
    status: 'completed',
    urgent: false,
    remark: '需要发票',
  },
  {
    id: 4,
    orderNo: 'AT20261021004',
    createdAt: '2026-10-21 13:15',
    customerName: '赵六',
    itemCount: 2,
    amount: 358,
    paymentMethod: 'wechat',
    status: 'cancelled',
    urgent: true,
    remark: '客户取消',
  },
  {
    id: 5,
    orderNo: 'AT20261021005',
    createdAt: '2026-10-21 14:20',
    customerName: '孙七',
    itemCount: 5,
    amount: 2460,
    paymentMethod: 'alipay',
    status: 'shipped',
    urgent: false,
    remark: '',
  },
  {
    id: 6,
    orderNo: 'AT20261021006',
    createdAt: '2026-10-21 15:05',
    customerName: '周八',
    itemCount: 1,
    amount: 128,
    paymentMethod: 'wechat',
    status: 'pending',
    urgent: false,
    remark: '工作日送达',
  },
  {
    id: 7,
    orderNo: 'AT20261021007',
    createdAt: '2026-10-21 16:40',
    customerName: '吴九',
    itemCount: 4,
    amount: 980,
    paymentMethod: 'bankcard',
    status: 'completed',
    urgent: true,
    remark: '',
  },
  {
    id: 8,
    orderNo: 'AT20261021008',
    createdAt: '2026-10-21 17:10',
    customerName: '郑十',
    itemCount: 6,
    amount: 3120,
    paymentMethod: 'alipay',
    status: 'shipped',
    urgent: false,
    remark: '易碎品',
  },
  {
    id: 9,
    orderNo: 'AT20261021009',
    createdAt: '2026-10-21 18:00',
    customerName: '冯十一',
    itemCount: 2,
    amount: 466,
    paymentMethod: 'wechat',
    status: 'pending',
    urgent: false,
    remark: '',
  },
  {
    id: 10,
    orderNo: 'AT20261021010',
    createdAt: '2026-10-21 19:30',
    customerName: '陈十二',
    itemCount: 9,
    amount: 7200,
    paymentMethod: 'bankcard',
    status: 'completed',
    urgent: true,
    remark: '批量采购',
  },
  {
    id: 11,
    orderNo: 'AT20261021011',
    createdAt: '2026-10-21 20:15',
    customerName: '褚十三',
    itemCount: 3,
    amount: 840,
    paymentMethod: 'alipay',
    status: 'shipped',
    urgent: false,
    remark: '',
  },
  {
    id: 12,
    orderNo: 'AT20261021012',
    createdAt: '2026-10-21 21:45',
    customerName: '卫十四',
    itemCount: 1,
    amount: 158,
    paymentMethod: 'wechat',
    status: 'cancelled',
    urgent: false,
    remark: '地址有误',
  },
]

/** 基础示例：受控排序（组件只 emit，数据排序由业务方决定） */
const sortKey = ref<string>()
const sortOrder = ref<'asc' | 'desc' | null>(null)
function onSort(payload: { key: string; order: 'asc' | 'desc' | null }) {
  sortKey.value = payload.key
  sortOrder.value = payload.order
}

/** 选择与分页示例 */
const page = ref(1)
const pageSize = ref(5)
const selectedKeys = ref<(string | number)[]>([])
const pagedRows = computed(() =>
  rows.slice((page.value - 1) * pageSize.value, page.value * pageSize.value),
)
</script>

# AtProTable 数据表格

由字段协议（`FieldDef[]`）直接驱动列定义，列通过 `fields.map(toColumnSchema)` 推导，组件内不重复实现列推导。

> 架构约定：这张表的 `fields` 将来会原样传给 AtSearchForm，搜索区与表格列由同一份字段描述驱动，不存在"搜索专用"的第二套配置类型。

## 基础表格

列设置面板由原生 `<details>` 实现；点击可排序列的表头，按 `asc → desc → null` 循环派发 `update:sort`。

<AtProTable
  :fields="orderFields"
  :data="rows"
  row-key="id"
  :sort-key="sortKey"
  :sort-order="sortOrder"
  @update:sort="onSort"
/>

```vue
<AtProTable :fields="orderFields" :data="rows" row-key="id" />
```

## 带选择与分页

选择、分页全部为受控：组件只派发事件，翻页后的数据由业务方切分。

<AtProTable
  :fields="orderFields"
  :data="pagedRows"
  row-key="id"
  selectable
  :selected-keys="selectedKeys"
  :page="page"
  :page-size="pageSize"
  :total="rows.length"
  @update:page="page = $event"
  @update:page-size="pageSize = $event"
  @update:selected-keys="selectedKeys = $event"
/>

```vue
<AtProTable
  :fields="orderFields"
  :data="pagedRows"
  row-key="id"
  selectable
  :selected-keys="selectedKeys"
  :page="page"
  :page-size="pageSize"
  :total="rows.length"
  @update:page="page = $event"
  @update:page-size="pageSize = $event"
  @update:selected-keys="selectedKeys = $event"
/>
```

## 自定义单元格

通过 `cell-{key}` 插槽覆盖单元格渲染，作用域为 `{ row, value, index }`：

<AtProTable :fields="orderFields" :data="rows.slice(0, 4)" row-key="id">
  <template #cell-amount="{ value }">
    <strong style="color: var(--at-color-primary)">￥{{ Number(value).toFixed(2) }}</strong>
  </template>
  <template #cell-status="{ value }">
    <span
      style="
        padding: 0 var(--at-space-xs);
        border-radius: var(--at-radius-sm);
        background-color: var(--at-color-bg-subtle);
        color: var(--at-color-text-2);
      "
    >{{ value }}</span>
  </template>
</AtProTable>

```vue
<AtProTable :fields="orderFields" :data="rows.slice(0, 4)" row-key="id">
  <template #cell-amount="{ value }">
    <strong>￥{{ Number(value).toFixed(2) }}</strong>
  </template>
</AtProTable>
```

## 空态

`data` 为空且 `loading` 为 `false` 时显示空态，可用 `empty` 插槽替换文案：

<AtProTable :fields="orderFields" :data="[]" row-key="id" />

```vue
<AtProTable :fields="orderFields" :data="[]" />
```

## 分页数据约定

组件**不做内部切片**：`data` 必须就是当前页的数据，翻页由业务方拉取或切分后传入。

- `data`：当前页数据，组件原样渲染
- `total`：总条数；不传时按 `data.length` 计算（此时分页等于只有一页）
- `rowKey`：必须稳定且唯一。缺失或重复时，选中状态与行 key 都不可靠
- `update:page` / `update:pageSize` 只派发事件，不会自行修改 `page` / `pageSize`

父组件完整示例：

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { AtProTable } from '@lingxu-yyy/atlas-ui'
import type { FieldDef } from '@lingxu-yyy/atlas-ui'

const fields: FieldDef[] = orderFields
const allRows = ref<Record<string, unknown>[]>([])
const page = ref(1)
const pageSize = ref(10)

const pagedRows = computed(() =>
  allRows.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value),
)
</script>

<template>
  <AtProTable
    :fields="fields"
    :data="pagedRows"
    row-key="id"
    :page="page"
    :page-size="pageSize"
    :total="allRows.length"
    @update:page="page = $event"
    @update:page-size="pageSize = $event"
  />
</template>
```

## API

### Props

| 属性 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| fields | 字段协议 | `FieldDef[]` | 必填 |
| data | 当前页数据 | `Record<string, unknown>[]` | 必填 |
| rowKey | 行唯一键字段名 | `string` | `'id'` |
| loading | 加载中（显示 3 行骨架） | `boolean` | `false` |
| page | 当前页（受控） | `number` | `1` |
| pageSize | 每页条数 | `number` | `10` |
| total | 总条数，缺省取 `data.length` | `number` | — |
| pageSizes | 每页条数候选 | `number[]` | `[10, 20, 50, 100]` |
| selectable | 是否显示选择列 | `boolean` | `false` |
| selectedKeys | 已选行 key（受控） | `(string \| number)[]` | `[]` |
| sortKey | 排序列（受控） | `string` | — |
| sortOrder | 排序方向（受控） | `'asc' \| 'desc' \| null` | `null` |
| emptyText | 空态文案 | `string` | `'暂无数据'` |
| striped | 斑马纹 | `boolean` | `false` |
| bordered | 单元格边框 | `boolean` | `false` |

### Emits

| 事件 | 说明 | 参数 |
| --- | --- | --- |
| update:page | 页码变化 | `page: number` |
| update:pageSize | 每页条数变化（同时派发 `update:page(1)`） | `size: number` |
| update:sort | 表头排序三态变化 | `{ key: string; order: 'asc' \| 'desc' \| null }` |
| update:selectedKeys | 选择变化 | `keys: (string \| number)[]` |
| row-click | 行点击 | `row: Record<string, unknown>` |

### Slots

| 插槽 | 说明 | 作用域 |
| --- | --- | --- |
| empty | 空态内容 | — |
| toolbar | 表格上方工具区 | — |
| cell-{key} | 自定义单元格 | `{ row, value, index }` |
| header-{key} | 自定义表头 | `{ field }` |

`header-{key}` 插槽用于替换表头文案；排序图标与 `aria-sort` 仍由组件维护。
