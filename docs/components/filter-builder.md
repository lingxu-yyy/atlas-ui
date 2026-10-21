<script setup lang="ts">
import { ref } from 'vue'

import { AtFilterBuilder } from '../../src/index'
import type { FilterNode } from '../../src/components/AtFilterBuilder/types'
import { orderFields } from '../../tests/fixtures/order-fields'

function stringify(value: FilterNode | null): string {
  return JSON.stringify(value, null, 2)
}

/* ---------- 示例 1：根组 ---------- */

const rootModel = ref<FilterNode | null>({
  type: 'group',
  logic: 'and',
  children: [
    { type: 'condition', key: 'status', operator: 'eq', value: 'shipped' },
    { type: 'condition', key: 'amount', operator: 'gt', value: 100 },
  ],
})
const rootOutput = ref(stringify(rootModel.value))

function onRootChange(value: FilterNode | null) {
  rootOutput.value = stringify(value)
}

/* ---------- 示例 2：嵌套组 ---------- */

const nestedModel = ref<FilterNode | null>({
  type: 'group',
  logic: 'and',
  children: [
    { type: 'condition', key: 'status', operator: 'eq', value: 'shipped' },
    {
      type: 'group',
      logic: 'or',
      children: [
        { type: 'condition', key: 'amount', operator: 'gt', value: 100 },
        { type: 'condition', key: 'urgent', operator: 'eq', value: true },
      ],
    },
  ],
})
const nestedOutput = ref(stringify(nestedModel.value))

function onNestedChange(value: FilterNode | null) {
  nestedOutput.value = stringify(value)
}

/* ---------- 示例 3：between ---------- */

const betweenModel = ref<FilterNode | null>({
  type: 'group',
  logic: 'and',
  children: [
    { type: 'condition', key: 'amount', operator: 'between', value: [100, 500] },
  ],
})
const betweenOutput = ref(stringify(betweenModel.value))

function onBetweenChange(value: FilterNode | null) {
  betweenOutput.value = stringify(value)
}

/* ---------- 示例 4：空态 ---------- */

const emptyModel = ref<FilterNode | null>(null)
const emptyOutput = ref(stringify(null))

function onEmptyChange(value: FilterNode | null) {
  emptyOutput.value = stringify(value)
}
</script>

# AtFilterBuilder 条件构造器

`AtFilterBuilder` 把 `FieldDef[]` 组织成一棵可嵌套的条件树，输出纯数据的 `FilterNode | null`。它只负责**构造条件**：不做 SQL 生成、不发请求，条件怎么翻译由业务方决定。

## 基础：根组

根组默认是 `and`，可以切换为 `or`。点「添加条件」新增叶子，点「添加分组」新增嵌套组。

<div id="demo-root">
  <AtFilterBuilder
    v-model="rootModel"
    :fields="orderFields"
    @change="onRootChange"
  />

  <pre style="margin-top: 16px; padding: 12px; background: #f7f8fa; border-radius: 4px; overflow: auto;">{{ rootOutput }}</pre>
</div>

## 嵌套组

嵌套组的逻辑与根组相互独立。`maxDepth` 默认 3（根组算第 1 层），到达上限后「添加分组」按钮自动禁用。

<div id="demo-nested">
  <AtFilterBuilder
    v-model="nestedModel"
    :fields="orderFields"
    @change="onNestedChange"
  />

  <pre style="margin-top: 16px; padding: 12px; background: #f7f8fa; border-radius: 4px; overflow: auto;">{{ nestedOutput }}</pre>
</div>

上面的树就是「状态 = 已发货 **AND**（金额 > 100 **OR** 加急 = 是）」。

## 运算符联动：between 渲染两个输入

运算符不是全量列出的，而是跟随字段类型；切到 `between` 后 value 控件会变成两个输入框。

<div id="demo-between">
  <AtFilterBuilder
    v-model="betweenModel"
    :fields="orderFields"
    @change="onBetweenChange"
  />

  <pre style="margin-top: 16px; padding: 12px; background: #f7f8fa; border-radius: 4px; overflow: auto;">{{ betweenOutput }}</pre>
</div>

## 空态

没有任何有效条件时，输出是 `null` 而不是空组：

<div id="demo-empty">
  <AtFilterBuilder
    v-model="emptyModel"
    :fields="orderFields"
    @change="onEmptyChange"
  />

  <pre style="margin-top: 16px; padding: 12px; background: #f7f8fa; border-radius: 4px; overflow: auto;">{{ emptyOutput }}</pre>
</div>

## 运算符映射

| 字段 type | 可选 operator |
| --- | --- |
| text | `like`、`eq` |
| number | `eq`、`gt`、`gte`、`lt`、`lte`、`between` |
| date | `eq`、`between`、`gt`、`lt` |
| select | `eq`、`in` |
| boolean | `eq` |
| custom | 不进入字段下拉（没有可用的运算符） |

`between` 的 value 固定是两元数组 `[下限, 上限]`；`in` 的 value 是数组；其余运算符是单值。

## 剪枝与回填

- **发射前剪枝**：空值叶子（`''`、`undefined`、`null`、空数组）与空组一律剔除；整棵树为空时 emit `null`。
- **回填容错**：`modelValue` 中字段不存在的 `key` 会被静默丢弃，不报错、不崩溃；运算符不合法时回落到该字段的第一个可用运算符。
- **输出稳定**：同一棵树连续两次 emit 的 JSON 完全相等，可直接用于比较或缓存。

## API

### Props

| 属性 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| fields | 与 AtProTable / AtSearchForm 共用的字段协议 | `FieldDef[]` | 必填 |
| modelValue | 条件树（受控） | `FilterNode \| null` | — |
| maxDepth | 最大嵌套层数，根组算第 1 层 | `number` | `3` |
| disabled | 只读，禁用全部控件与按钮 | `boolean` | `false` |

### Emits

| 事件 | 说明 | 参数 |
| --- | --- | --- |
| update:modelValue | 任一条件、运算符、值、逻辑或结构变化 | `FilterNode \| null` |
| change | 与 `update:modelValue` 同值，便于业务侧监听 | `FilterNode \| null` |

### 类型

```ts
type Logic = 'and' | 'or'

interface FilterLeaf {
  type: 'condition'
  key: string
  operator: SearchOperator
  value: unknown
}

interface FilterGroup {
  type: 'group'
  logic: Logic
  children: FilterNode[]
}

type FilterNode = FilterLeaf | FilterGroup
```

> 架构约束：`operator` 只能使用已冻结的 `SearchOperator`；字段协议 `FieldDef` 与 `schema.ts` 不因本组件改动。本组件不生成 SQL、不新增依赖。
