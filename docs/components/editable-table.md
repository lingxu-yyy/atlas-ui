<script setup lang="ts">
import { computed, ref } from 'vue'

import { AtEditableTable, AtSearchForm } from '../../src/index'
import type { AtEditableTableChange } from '../../src/components/AtEditableTable/types'
import type { AtSearchFormSearchPayload } from '../../src/components/AtSearchForm/types'
import { orderFields } from '../../tests/fixtures/order-fields'

const rows = ref<Record<string, unknown>[]>([
  { id: 1, orderNo: 'AT20261021001', createdAt: '2026-10-21 10:00', customerName: '张三', itemCount: 3, amount: 1299.5, paymentMethod: 'wechat', status: 'shipped', urgent: true, remark: '尽快发货' },
  { id: 2, orderNo: 'AT20261021002', createdAt: '2026-10-21 11:00', customerName: '李四', itemCount: 1, amount: 99, paymentMethod: 'alipay', status: 'pending', urgent: false, remark: '' },
  { id: 3, orderNo: 'AT20261021003', createdAt: '2026-10-21 12:30', customerName: '王五', itemCount: 8, amount: 5680, paymentMethod: 'bankcard', status: 'completed', urgent: false, remark: '需要发票' },
  { id: 4, orderNo: 'AT20261021004', createdAt: '2026-10-21 13:15', customerName: '赵六', itemCount: 2, amount: 358, paymentMethod: 'wechat', status: 'cancelled', urgent: true, remark: '客户取消' },
])

const model = ref<Record<string, unknown>>({})
const applied = ref<Record<string, unknown>>({})

const filteredRows = computed(() =>
  rows.value.filter((row) =>
    Object.entries(applied.value).every(([key, value]) => {
      if (Array.isArray(value)) return value.length === 0 || value.includes(row[key])
      if (typeof value === 'string') return String(row[key] ?? '').includes(value)
      return row[key] === value
    }),
  ),
)

function apply(payload: AtSearchFormSearchPayload) {
  applied.value = payload.values
}

/** 保存由父组件负责：组件只 emit changes，数据更新发生在这里 */
function onSave(payload: { changes: AtEditableTableChange[] }) {
  const patches = new Map(payload.changes.map((change) => [change.key, change.patch]))
  rows.value = rows.value.map((row) =>
    patches.has(row.id as number) ? { ...row, ...patches.get(row.id as number) } : row,
  )
}
</script>

# AtEditableTable 行内编辑表格

## 一份 orderFields：搜索区、表格、行内编辑

三个组件共用同一个 `FieldDef[]`，没有第二套编辑配置：

```vue
<AtSearchForm :fields="orderFields" />
<AtEditableTable :fields="orderFields" :data="rows" @save="onSave" />
```

试着改一行「客户名」——行首会出现橙色脏标记，点「保存」后由父组件更新数据；清空客户名再保存，会触发 `required` 校验失败。

<AtSearchForm
  :fields="orderFields"
  :model-value="model"
  @update:model-value="model = $event"
  @search="apply"
  @reset="apply"
/>

<AtEditableTable
  :fields="orderFields"
  :data="filteredRows"
  row-key="id"
  @save="onSave"
/>

## 数据流：组件只读，父组件负责保存

组件**绝不修改** `props.data`。编辑只写入内部草稿，保存时一次性 emit：

```ts
'save' ({ changes })   // changes: Array<{ key, patch, row }>，一次包含全部脏行
```

父组件用 `patch` 更新自己的数据后，新数据回流，草稿里与新区值相同的字段会自动清除脏标记——这是清理脏状态的唯一机制，没有 `clearDirty` 之类的命令式 API。

草稿按 `rowKey` 存放，不按数组下标存放，排序、翻页、过滤后都不会串行。

## 行状态机

```text
             输入
pristine ───────────▶ dirty ───────────▶ invalid
   ▲                    │  ▲                 │
   │  改回原值 / Esc     │  │  校验通过        │ 保存校验失败
   └────────────────────┘  └─────────────────┘

保存成功：父组件更新 data → 草稿与新原值一致 → 自动回到 pristine
```

- **pristine**：草稿与原值一致
- **dirty**：草稿与原值不同且尚未保存
- **invalid**：保存校验失败，单元格标红并展示 `rule.message`

校验只在点击保存时执行，输入过程中不打扰用户。

## API

### Props

| 属性 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| fields | 与 AtSearchForm / AtProTable 共用的字段协议 | `FieldDef[]` | 必填 |
| data | 只读数据源，组件不会修改 | `Record<string, unknown>[]` | 必填 |
| rowKey | 行唯一键，草稿按它存放 | `string` | `'id'` |
| editable | 全局编辑开关 | `boolean` | `true` |
| loading | 加载中 | `boolean` | `false` |
| saving | 保存中，禁用全部输入与保存按钮 | `boolean` | `false` |

### Emits

| 事件 | 说明 | 参数 |
| --- | --- | --- |
| save | 全部脏行校验通过 | `{ changes: Array<{ key, patch, row }> }` |
| cancel | 行级撤销或撤销全部 | `{ keys: (string \| number)[] }` |
| validate-fail | 存在校验失败的脏行，不触发 save | `Array<{ key, field, message }>` |
| dirty-change | 脏行集合变化 | `(string \| number)[]` |

### Slots

| 插槽 | 说明 |
| --- | --- |
| toolbar | 替换默认的「保存 N 项修改 / 撤销全部」 |
| cell-{key} | 只读单元格（`editable: false` 或 custom）的自定义展示 |

## 可编辑性与校验

- `isEditable(field)`：`custom` 恒为 `false`，其余取 `field.editable ?? true`
- 校验只读取 `field.rules`，支持 `required` / `min` / `max` / `pattern` / `validator`，提示文案取 `rule.message`
- 行首脏标记使用 `--at-color-warning`，校验失败使用 `--at-color-danger`，均为设计 token

> 架构约束：字段信息、可见性与校验规则全部来自 `FieldDef[]`，编辑表格不存在独立的 schema 或校验配置。
