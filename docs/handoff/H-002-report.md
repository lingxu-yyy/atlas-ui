# H-002 AtFilterBuilder 条件构造器 交付报告

## 改动文件

新增：
- `src/components/AtFilterBuilder/types.ts`
- `src/components/AtFilterBuilder/AtFilterBuilder.vue`
- `src/components/AtFilterBuilder/index.ts`
- `tests/AtFilterBuilder.test.ts`（14 条用例）
- `docs/components/filter-builder.md`

修改：
- `src/index.ts`（导出 AtFilterBuilder 与 5 个类型）
- `docs/.vitepress/config.ts`（侧边栏新增一行）
- `docs/handoff/H-002-report.md`（本报告）

未改 `src/types/schema.ts`、`src/utils/schema.ts`、`vite.config.ts`、`package.json`，未新增依赖。

## 验收线逐条结果（命令原文 + 输出）

### 1. lint 0 warning

```text
$ pnpm lint
$ eslint .
```

无任何输出，退出码 0。

### 2. typecheck 0

```text
$ pnpm typecheck
$ vue-tsc --noEmit
```

无任何输出，退出码 0。

### 3. test 总条数与新增

```text
$ pnpm test
$ vitest run

 RUN  v3.2.7 C:/Users/Administrator/Documents/Trae-CN/default/atlas-ui

 ✓ tests/virtual.test.ts (6 tests) 7ms
 ✓ tests/image-utils.test.ts (7 tests) 7ms
 ✓ tests/schema.test.ts (14 tests) 11ms
 ✓ tests/smoke.test.ts (1 test) 4ms
 ✓ tests/AtImageUploader.test.ts (14 tests) 242ms
 ✓ tests/AtVirtualSelect.test.ts (14 tests) 322ms
 ✓ tests/AtButton.test.ts (9 tests) 184ms
stdout | tests/AtFilterBuilder.test.ts > AtFilterBuilder 验收场景 > 构造「状态=已发货 AND (金额>100 OR 加急=是)」
FILTER_DEMO_JSON={"type":"group","logic":"and","children":[{"type":"condition","key":"status","operator":"eq","value":"shipped"},{"type":"group","logic":"or","children":[{"type":"condition","key":"amount","operator":"gt","value":100},{"type":"condition","key":"urgent","operator":"eq","value":true}]}]}

 ✓ tests/AtFilterBuilder.test.ts (14 tests) 401ms
 ✓ tests/AtSearchForm.test.ts (13 tests) 339ms
 ✓ tests/AtEditableTable.test.ts (20 tests) 482ms
 ✓ tests/AtProTable.test.ts (15 tests) 443ms

 Test Files  11 passed (11)
      Tests  127 passed (127)
   Start at  22:34:38
   Duration  3.04s (transform 2.25s, setup 0ms, collect 7.46s, tests 2.44s, environment 13.13s, prepare 3.12s)
```

新增 14 条（要求 ≥12），覆盖：添加条件、operator 按类型过滤、between 双输入、空值剪枝、空组剪枝与全空为 null、maxDepth 禁用、AND/OR 切换、回填还原控件、未知 key 丢弃、删除叶子、连续两次 emit JSON 相等、disabled 全只读、change 与 update:modelValue 同值、验收场景树。

新增用例清单（`AtFilterBuilder.test.ts` 14/14 全绿）：

```text
 ✓ 添加条件：新增一行，填值后 emit 条件树
 ✓ 运算符按字段类型过滤，不把全部 operator 列出来
 ✓ 切到 between 后渲染两个输入框，值按数组 emit
 ✓ 空值叶子被剪掉，整棵树为空时 emit null
 ✓ 空组被剪掉，全空时 emit null；填值后组保留
 ✓ 到达 maxDepth 后「添加分组」按钮禁用
 ✓ AND / OR 切换后 emit 新的 logic
 ✓ 回填 modelValue 时还原根组、嵌套组与各类控件
 ✓ 回填时未知 key 静默丢弃，不报错
 ✓ 删除叶子后只剩其余条件
 ✓ 同一棵树连续两次 emit 的 JSON 完全相等
 ✓ update:modelValue 与 change 携带同一份值
 ✓ disabled 时所有控件只读且不 emit
 ✓ 构造「状态=已发货 AND (金额>100 OR 加急=是)」
```

### 4. build 体积

```text
$ pnpm build
$ vite build && vue-tsc -p tsconfig.build.json
vite v6.4.4 building for production...
transforming...
✓ 38 modules transformed.
rendering chunks...
computing gzip size...
dist/style.css                                                    25.94 kB │ gzip: 3.61 kB
dist/components/AtButton/index.js                                  0.11 kB │ gzip: 0.12 kB
dist/components/AtProTable/index.js                                0.12 kB │ gzip: 0.12 kB
dist/components/AtSearchForm/index.js                              0.12 kB │ gzip: 0.12 kB
dist/components/AtEditableTable/index.js                           0.13 kB │ gzip: 0.12 kB
dist/components/AtImageUploader/index.js                           0.13 kB │ gzip: 0.13 kB
dist/components/AtVirtualSelect/index.js                           0.13 kB │ gzip: 0.13 kB
dist/AtButton.vue_vue_type_style_index_0_lang-BqTMTGeu.js          1.20 kB │ gzip: 0.62 kB
dist/schema-Drl2j5Dk.js                                            1.32 kB │ gzip: 0.51 kB
dist/AtSearchForm.vue_vue_type_style_index_0_lang-DSLD9Euv.js      8.95 kB │ gzip: 2.63 kB
dist/index.js                                                     12.66 kB │ gzip: 3.25 kB
dist/AtProTable.vue_vue_type_style_index_0_lang-BOGgusFY.js       13.03 kB │ gzip: 3.85 kB
dist/AtImageUploader.vue_vue_type_style_index_0_lang-B72HB9R5.js  13.88 kB │ gzip: 4.52 kB
dist/AtVirtualSelect.vue_vue_type_style_index_0_lang-C7s-me8I.js  14.81 kB │ gzip: 4.38 kB
dist/AtEditableTable.vue_vue_type_style_index_0_lang-QrueqeBW.js  15.35 kB │ gzip: 3.97 kB
dist/style.css                                                     25.94 kB │ gzip: 3.61 kB
dist/components/AtButton/index.cjs                                  0.19 kB │ gzip: 0.18 kB
dist/components/AtProTable/index.cjs                                0.19 kB │ gzip: 0.18 kB
dist/components/AtSearchForm/index.cjs                              0.20 kB │ gzip: 0.18 kB
dist/components/AtEditableTable/index.cjs                          0.20 kB │ gzip: 0.18 kB
dist/components/AtImageUploader/index.cjs                          0.20 kB │ gzip: 0.19 kB
dist/components/AtVirtualSelect/index.cjs                          0.20 kB │ gzip: 0.18 kB
dist/AtButton.vue_vue_type_style_index_0_lang-B6wA7rVx.cjs          0.91 kB │ gzip: 0.51 kB
dist/schema-fJjNhhtl.cjs                                            1.05 kB │ gzip: 0.48 kB
dist/AtSearchForm.vue_vue_type_style_index_0_lang-DHNgFmV8.cjs      6.35 kB │ gzip: 2.26 kB
dist/index.cjs                                                      8.38 kB │ gzip: 2.79 kB
dist/AtProTable.vue_vue_type_style_index_0_lang-B7GHqaZN.cjs        9.92 kB │ gzip: 3.28 kB
dist/AtImageUploader.vue_vue_type_style_index_0_lang-CFqmRE3Y.cjs  10.22 kB │ gzip: 3.95 kB
dist/AtVirtualSelect.vue_vue_type_style_index_0_lang-kOQbNB2Q.cjs  10.63 kB │ gzip: 3.68 kB
dist/AtEditableTable.vue_vue_type_style_index_0_lang-BHqU8tbG.cjs  10.69 kB │ gzip: 3.37 kB
✓ built in 1.14s
```

产物字节数：

```text
Get-Item dist/index.js, dist/index.cjs, dist/style.css | Select-Object Name, Length

Name      Length
----      ------
index.js   12660
index.cjs   8378
style.css  25938
```

声明文件已包含新组件：

```text
Select-String -Path dist/index.d.ts -Pattern "AtFilterBuilder" -SimpleMatch

dist\index.d.ts:12:export { AtFilterBuilder } from './components/AtFilterBuilder';
dist\index.d.ts:13:export type { AtFilterBuilderProps, FilterGroup, FilterLeaf, FilterNode, Logic, } from './components/AtFilterBuilder';
```

### 5. docs:build

```text
$ pnpm docs:build
$ vitepress build docs

  vitepress v1.6.4

- building client + server bundles...
✓ building client + server bundles...
- rendering pages...
✓ rendering pages...
build complete in 4.09s.
```

### 6. 三张截图

截图存放在仓库外，避免污染提交：`C:\Users\Administrator\Documents\Trae-CN\default\atlas-ui-h002-screenshots`

| 文件 | 内容 |
| --- | --- |
| `01-root-group.png`（113,854 B） | 根组：条件组 / 全部满足（AND）/ 添加条件 / 添加分组 + 两条条件 + JSON 输出 |
| `02-nested-group.png`（74,889 B） | 嵌套组：子条件组「任一满足（OR）」，金额>100 与加急=是 + JSON 输出 |
| `03-between.png`（78,055 B） | between 状态：订单金额 介于 [100] 至 [500]，JSON 中 `"operator": "between", "value": [100, 500]` |

截图基于 `pnpm docs:dev --port 4173` 的 `/components/filter-builder` 页面，未修改任何表单值；控制台无报错，无失败网络请求。

### 7. 指定条件树的 emit JSON（原样）

用 `orderFields` 通过 UI 构造「状态=已发货 AND (金额>100 OR 加急=是)」，最后两次 emit 的 JSON：

```json
{"type":"group","logic":"and","children":[{"type":"condition","key":"status","operator":"eq","value":"shipped"},{"type":"group","logic":"or","children":[{"type":"condition","key":"amount","operator":"gt","value":100},{"type":"condition","key":"urgent","operator":"eq","value":true}]}]}
```

格式化：

```json
{
  "type": "group",
  "logic": "and",
  "children": [
    {
      "type": "condition",
      "key": "status",
      "operator": "eq",
      "value": "shipped"
    },
    {
      "type": "group",
      "logic": "or",
      "children": [
        {
          "type": "condition",
          "key": "amount",
          "operator": "gt",
          "value": 100
        },
        {
          "type": "condition",
          "key": "urgent",
          "operator": "eq",
          "value": true
        }
      ]
    }
  ]
}
```

纯对象，不含函数、不含 `undefined`（`JSON.stringify` 与对象深比较均通过）。

### 8. git 状态

```text
$ git status --short
 M docs/.vitepress/config.ts
 M src/index.ts
?? docs/components/filter-builder.md
?? src/components/AtFilterBuilder/
?? tests/AtFilterBuilder.test.ts
```

上述为初次交付时的 git 状态；验收通过后已按指定路径分两次提交并推送。

## 偏差与风险

- **`--reporter=append-only` 不是合法的 Vitest reporter**：首次执行 `pnpm vitest run tests/AtFilterBuilder.test.ts --reporter=append-only` 报 `Failed to load custom Reporter from append-only`。改用默认 reporter 执行，其他验收命令均照常。已按验收意见把 AGENTS.md 第 6 条改为「pnpm install 用 --reporter=append-only；vitest 用 --reporter=verbose」。
- **组件级子入口**：H-002 初次交付的文件清单不含 `vite.config.ts` / `package.json`，当时 AtFilterBuilder 被打进 `dist/index.js`（12.66 kB）。验收通过后已补齐 lib 第 8 个入口与 exports 子路径，`dist/index.js` 回到 962 B，AtFilterBuilder 代码进入独立共享 chunk，结果见下方补充节。
- **custom 字段不进入字段下拉**：因为规则 1 没有给 custom 定义任何 operator；其余字段不做 `searchable` 过滤（H-002 未要求）。
- **`between` 半填状态**：只有两个输入都为空时才视为空值剪枝；只填一侧时按原样输出数组（如 `[100, ""]`），未自行规定「必须两侧都填」。
- **单叶子根节点**：若 `modelValue` 直接传一个 `FilterLeaf`，回填时会被包进 `logic: 'and'` 的根组，保证根节点恒为组。

## 通过后补充：组件级入口（H-002 验收后）

补充改动：
- `vite.config.ts` 的 `lib.entry` 增加 `components/AtFilterBuilder`
- `package.json` 的 `exports` 增加 `./components/AtFilterBuilder`
- `AGENTS.md` 第 6 条修正 vitest reporter 用法

重新构建的关键输出：

```text
$ pnpm build
dist/components/AtFilterBuilder/index.js                           0.13 kB │ gzip: 0.13 kB
dist/index.js                                                      0.96 kB │ gzip: 0.38 kB
dist/AtFilterBuilder.vue_vue_type_style_index_0_lang-Dk0s7VPa.js  11.79 kB │ gzip: 2.94 kB
dist/components/AtFilterBuilder/index.cjs                          0.20 kB │ gzip: 0.18 kB
dist/index.cjs                                                      1.08 kB │ gzip: 0.43 kB
dist/AtFilterBuilder.vue_vue_type_style_index_0_lang-BvRyPUKD.cjs   7.41 kB │ gzip: 2.47 kB
✓ built in 771ms
```

体积与引用关系：

```text
index.js                                                        127
index.cjs                                                       203
index.js                                                        962
AtFilterBuilder.vue_vue_type_style_index_0_lang-Dk0s7VPa.js   11785
AtFilterBuilder.vue_vue_type_style_index_0_lang-BvRyPUKD.cjs   7410
```

```text
Get-Content dist\components\AtFilterBuilder\index.js
import { _ as t } from "../../AtFilterBuilder.vue_vue_type_style_index_0_lang-Dk0s7VPa.js";
export {
  t as AtFilterBuilder
};
```

- 子入口 `dist/components/AtFilterBuilder/index.js`：127 B，只引用 1 个 chunk `AtFilterBuilder.vue_vue_type_style_index_0_lang-Dk0s7VPa.js`（11,785 B）
- CJS 子入口 203 B，引用 `AtFilterBuilder.vue_vue_type_style_index_0_lang-BvRyPUKD.cjs`（7,410 B）
- `dist/index.js`：962 B，回到 1 KB 以内
- `dist` 顶层 `.js` 文件：9 个（`index.js` + 8 个共享 chunk；只算 chunk 则为 8 个）

