# 字段协议（schema）

> 状态：**已冻结** · 冻结日期：2026-10-21
> 消费方：AtProTable / AtSearchForm / AtEditableTable（后续全部基于本协议）

## 为什么是 discriminated union

如果只用一个"万能字段"接口，把所有属性都写成可选：

```ts
interface FieldSchema {
  key: string
  label: string
  type: string
  maxLength?: number   // 只有 text 有意义
  precision?: number   // 只有 number 有意义
  range?: boolean      // 只有 date 有意义
  multiple?: boolean   // 只有 select 有意义
  render?: (v: unknown) => VNodeChild // 只有 custom 必须有
}
```

会产生两个无法在编译期拦住的问题：

1. **非法组合能通过类型检查**：`{ type: 'boolean', precision: 2 }` 合法，但毫无意义，错误只能推迟到运行时暴露。
2. **必填项无法保证**：`custom` 类型缺少 `render` 也无法报错，组件只能写防御性 `if (!field.render)`。

拆成按 `type` 判别的联合类型后，TypeScript 依据判别字段自动收窄：

```ts
if (field.type === 'text') field.maxLength   // 有类型，且只有这里能访问
if (field.type === 'custom') field.render    // 必存在，无需判空
```

新增字段类型时，编译器会强制所有 `switch (field.type)` 处补齐分支——协议演进不会静默漏改。

## 一份字段，同时驱动搜索与表格

`FieldDef = FieldSchema & { searchable?, rules?, column? }`，字段定义本身就是"搜索条件 + 表格列"的共同来源：

```ts
{
  key: 'createdAt',
  label: '下单时间',
  type: 'date',
  range: true,                       // 搜索区渲染成时间范围
  format: 'YYYY-MM-DD HH:mm',
  width: 180,
}
```

- AtSearchForm 读 `type` / `range` / `options` 决定控件形态，读 `rules` 做校验
- AtProTable 走 `toColumnSchema(field)` 得到列：`title = label`、`key = key`，数字自动右对齐
- `searchable: false` 的字段（如订单号）只出现在表格，不出现搜索区
- `column` 只覆盖展示层差异（宽度、排序、固定列、格式化），不影响搜索行为

```ts
{
  key: 'orderNo',
  label: '订单号',
  type: 'text',
  searchable: false,                 // 不进搜索区
  column: { sortable: true, fixed: 'left' },
}
```

## 表单语义 vs 搜索语义

`getDefaultValue` 的 boolean 返回 `false`，这是**新建表单**的语义：一条新记录默认不是加急的。

但在搜索区里，`false` 是有效筛选值（否），不能被当成"未筛选"。两者混用会导致用户什么都没选时，结果被静默限制为"否"。因此：

- 搜索区里"未筛选"必须用空值 `''` 表示，而不是 `false`
- `AtSearchForm` 对布尔字段的初始值与重置值使用 `''`，不使用 `getDefaultValue`
- 这不是协议变更，是使用场景差异；后续任何"搜索 / 筛选"类组件都遵循同一规则

示例：未选择 = 全部；选「是」→ `true`；选「否」→ `false`。

## 扩展方式：只走 registry

新增一个字段类型（例如 `rating`）的合法路径：

1. 在 `src/types/schema.ts` 的 `FieldSchema` 联合中新增一个 interface
2. 实现 `FieldRenderer`，通过 `createRendererRegistry().register('rating', renderer)` 注册
3. 需要自定义列展示时，通过 `FieldRenderer` 或 `column.formatter` 完成

**禁止**在组件内部写 `if (field.type === 'rating')` / `switch` 硬分支。registry 之外的扩展方式一律不接受。

```ts
const registry = createRendererRegistry()
registry.register('rating', ({ value }) => renderStars(Number(value)))
registry.get('rating')   // 有则返回渲染器
registry.has('rating')   // 布尔
```

## 变更流程

协议已冻结，修改需要走正式流程：

1. 提出变更原因与兼容性影响（破坏性 / 非破坏性）
2. 同步更新三处：`src/types/schema.ts`、`src/utils/schema.ts`、`docs/schema.md`
3. 补充或调整 `tests/schema.test.ts` 与 `tests/fixtures/*`，保证用例仍能表达真实业务
4. **协议变更必须同时升级 minor 版本**（`0.x.y` → `0.(x+1).0`），并在提交信息中注明 `BREAKING` 或 `feat(schema)`
5. 三个消费方组件同步适配后才允许发布

已冻结的部分：`FieldType` 取值、`FieldSchema` 各分支的字段名与类型、`FieldDef` 的交叉类型写法、`ColumnSchema` 结构、`SearchOperator` 取值。
