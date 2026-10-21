# atlas-ui

**一套补足 Element Plus 空白的 Vue 3 后台业务组件库 —— 零运行时依赖，纯 Vue 3 + TypeScript 自研。**

Vue 3 business components that fill the gaps in Element Plus · TypeScript, zero runtime dependencies.

[![CI](https://github.com/lingxu-yyy/atlas-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/lingxu-yyy/atlas-ui/actions/workflows/ci.yml)
[![Docs](https://img.shields.io/badge/docs-online-2f6bff)](https://lingxu-yyy.github.io/atlas-ui/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

**[在线文档与示例 →](https://lingxu-yyy.github.io/atlas-ui/)**

---

## 它解决什么问题

后台系统里，Element Plus 提供了足够的原件，但每个项目仍要重复写三样东西：搜索区、列表、行内编辑。而且通常是三套配置——改一个字段要动三个地方。

atlas-ui 的做法是：**写一次字段描述，三处复用。**

```ts
import type { FieldDef } from '@lingxu-yyy/atlas-ui'

export const orderFields: FieldDef[] = [
  { key: 'orderNo', label: '订单号', type: 'text', editable: false },
  { key: 'amount', label: '订单金额', type: 'number', precision: 2, unit: '元' },
  {
    key: 'status',
    label: '订单状态',
    type: 'select',
    options: [
      { label: '待付款', value: 'pending' },
      { label: '已发货', value: 'shipped' },
      { label: '已完成', value: 'completed' },
    ],
    rules: [{ required: true, message: '请选择订单状态' }],
  },
]
```

```vue
<AtSearchForm :fields="orderFields" @search="onSearch" />
<AtProTable :fields="orderFields" :data="rows" row-key="id" />
<AtEditableTable :fields="orderFields" :data="rows" row-key="id" @save="onSave" />
```

搜索条件按字段类型自动映射为 `like / eq / in / between`，表格列由 `toColumnSchema` 推导，编辑校验读 `rules`。同一份 `fields` 喂三个组件，不存在“搜索专用”的第二套配置类型。

## 组件

| 组件 | 解决什么 | 关键指标 |
| --- | --- | --- |
| `AtButton` | 基础按钮 | 3 variant × 3 size，loading 自动禁用，focus-visible |
| `AtProTable` | 字段驱动的数据表格 | 三态排序、列显隐、受控分页、骨架屏、原生 table 语义 |
| `AtSearchForm` | 查询表单 | 与表格**共用同一份 fields**，条件自动映射，可折叠 |
| `AtFilterBuilder` | 条件构造器 | AND/OR 嵌套（≤3 层）、operator 按字段类型过滤、输出可序列化条件树 |
| `AtEditableTable` | 行内编辑表格 | 草稿按 rowKey 存储，脏行标记、异步校验、**跨页脏行不丢失** |
| `AtVirtualSelect` | 虚拟滚动选择器 | **10,000 条数据，DOM 常驻 13–17 个节点**，远程搜索 300ms 防抖 |
| `AtImageUploader` | 图片上传 | Canvas 压缩实测 **728.1 KB → 167.6 KB（-77%）**，blob URL 全程回收 |

## 安装

尚未发布到 npm，从源码使用：

```bash
git clone https://github.com/lingxu-yyy/atlas-ui.git
cd atlas-ui
pnpm install
pnpm build
pnpm link --global
```

然后在业务项目里 `pnpm link --global @lingxu-yyy/atlas-ui`。

## 体积

按组件引入时只加载该组件自身的 chunk（Vue 为 peerDependency，不计入）：

| 引入方式 | 原始 | gzip |
| --- | --- | --- |
| `components/AtButton` | 1.28 KB | 0.72 KB |
| `components/AtFilterBuilder` | 11.63 KB | 2.99 KB |
| `components/AtSearchForm` | 10.15 KB | 3.19 KB |
| `components/AtProTable` | 14.13 KB | 4.38 KB |
| `components/AtImageUploader` | 13.68 KB | 4.54 KB |
| `components/AtVirtualSelect` | 14.58 KB | 4.39 KB |
| `components/AtEditableTable` | 16.40 KB | 4.50 KB |
| 全量入口（9 个 chunk 合计） | 79.38 KB | 23.23 KB |
| `style.css`（全量，不可摇树） | 25.94 KB | 3.61 KB |

两点说明：gzip 为各文件分别压缩后的合计，合并成单文件时会更低，但那不是真实加载形态；CSS 不支持 tree-shaking，引任一组件都会带上整份 style.css。

## 质量

- 127 条单元测试，Vitest + @vue/test-utils + jsdom
- CI 覆盖 lint / typecheck / test / build / docs:build，每次 push 自动跑
- 零运行时依赖，`vue` 只作为 peerDependency
- 所有视觉值走 design token（`--at-*`），组件内无裸色值

## 浏览器要求

使用了 `color-mix()` 等现代 CSS 特性，最低版本：Chrome 111 / Safari 16.2 / Firefox 113。

## 本地开发

```bash
pnpm install
pnpm dev        # 构建 watch
pnpm test       # 单元测试
pnpm lint
pnpm docs:dev   # 文档站
```

约定：

- pnpm 版本固定在 `package.json` 的 `packageManager` 字段，CI 与之完全一致
- 字段协议（`src/types/schema.ts`）是冻结的；变更需同步更新 `docs/schema.md` 的变更记录
- 新增字段类型只能通过 renderer registry 扩展，不在组件里写分支

## Roadmap

- v0.3：裁剪上传、表格虚拟滚动、组件级样式拆分、暗色主题

## License

[MIT](./LICENSE) © lingxu-yyy
