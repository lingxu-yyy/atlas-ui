# H-001 交付报告
## 改动文件
- `vite.config.ts`：lib 改为 7 个入口（index + 6 个组件），formats 仍为 ['es','cjs']，external 仍为 ['vue']，cssCodeSplit 仍为 false
- `package.json`：exports 新增 6 个组件子路径（types/import/require），原有 "." 与 "./style.css" 未动
- `docs/handoff/H-001-report.md`：本报告

未改 `src/**`、`tests/**`、`.github/**`，未新增依赖。

## 验收线逐条结果（命令原文 + 输出）

### 1. pnpm build
```text
$ vite build && vue-tsc -p tsconfig.build.json
vite v6.4.4 building for production...
✓ 34 modules transformed.
rendering chunks...
computing gzip size...
dist/style.css                                                    22.03 kB │ gzip: 3.26 kB
dist/components/AtButton/index.js                                  0.11 kB │ gzip: 0.12 kB
dist/components/AtProTable/index.js                                0.12 kB │ gzip: 0.12 kB
dist/components/AtSearchForm/index.js                              0.12 kB │ gzip: 0.12 kB
dist/components/AtEditableTable/index.js                           0.13 kB │ gzip: 0.12 kB
dist/components/AtImageUploader/index.js                           0.13 kB │ gzip: 0.13 kB
dist/components/AtVirtualSelect/index.js                           0.13 kB │ gzip: 0.13 kB
dist/index.js                                                      0.85 kB │ gzip: 0.36 kB
dist/AtButton.vue_vue_type_style_index_0_lang-BqTMTGeu.js          1.20 kB │ gzip: 0.62 kB
dist/schema-Drl2j5Dk.js                                            1.32 kB │ gzip: 0.51 kB
dist/AtSearchForm.vue_vue_type_style_index_0_lang-DSLD9Euv.js      8.95 kB │ gzip: 2.63 kB
dist/AtProTable.vue_vue_type_style_index_0_lang-BOGgusFY.js       13.03 kB │ gzip: 3.85 kB
dist/AtImageUploader.vue_vue_type_style_index_0_lang-B72HB9R5.js  13.88 kB │ gzip: 4.52 kB
dist/AtVirtualSelect.vue_vue_type_style_index_0_lang-C7s-me8I.js  14.81 kB │ gzip: 4.38 kB
dist/AtEditableTable.vue_vue_type_style_index_0_lang-QrueqeBW.js  15.35 kB │ gzip: 3.97 kB
dist/style.css                                                     22.03 kB │ gzip: 3.26 kB
dist/components/AtButton/index.cjs                                  0.19 kB │ gzip: 0.18 kB
dist/components/AtProTable/index.cjs                                0.19 kB │ gzip: 0.18 kB
dist/components/AtSearchForm/index.cjs                              0.20 kB │ gzip: 0.18 kB
dist/components/AtEditableTable/index.cjs                          0.20 kB │ gzip: 0.18 kB
dist/components/AtImageUploader/index.cjs                          0.20 kB │ gzip: 0.19 kB
dist/components/AtVirtualSelect/index.cjs                          0.20 kB │ gzip: 0.18 kB
dist/AtButton.vue_vue_type_style_index_0_lang-B6wA7rVx.cjs          0.91 kB │ gzip: 0.51 kB
dist/index.cjs                                                      0.97 kB │ gzip: 0.41 kB
dist/schema-fJjNhhtl.cjs                                            1.05 kB │ gzip: 0.48 kB
dist/AtSearchForm.vue_vue_type_style_index_0_lang-DHNgFmV8.cjs      6.35 kB │ gzip: 2.26 kB
dist/AtProTable.vue_vue_type_style_index_0_lang-B7GHqaZN.cjs        9.92 kB │ gzip: 3.28 kB
dist/AtImageUploader.vue_vue_type_style_index_0_lang-CFqmRE3Y.cjs  10.22 kB │ gzip: 3.95 kB
dist/AtVirtualSelect.vue_vue_type_style_index_0_lang-kOQbNB2Q.cjs  10.63 kB │ gzip: 3.68 kB
dist/AtEditableTable.vue_vue_type_style_index_0_lang-BHqU8tbG.cjs  10.69 kB │ gzip: 3.37 kB
✓ built in 640ms
```

### 2. 子入口体积
```text
Get-Item dist/components/AtButton/index.js | Select-Object Length

Length
------
   113
```
113 B = 0.11 KB，小于 3 KB。

### 3. 子入口导出
```text
node -e "import('./dist/components/AtButton/index.js').then(m=>console.log(Object.keys(m)))"
[ 'AtButton' ]
```

### 4. npm pack --dry-run
```text
npm notice total files: 58
```
（此前 32 个，增加 26 个：6 个子入口 × es/cjs + 12 个共享 chunk + package.json 体积变化）

### 5. dist/index.js 体积
```text
Get-Item dist/index.js | Select-Object Length

Length
------
   850
```
850 B，未变大（从 67.07 KB 变为转发入口，代码进入共享 chunk）。

### 6. pnpm test
```text
 ✓ tests/image-utils.test.ts (7 tests) 7ms
 ✓ tests/virtual.test.ts (6 tests) 7ms
 ✓ tests/schema.test.ts (14 tests) 9ms
 ✓ tests/smoke.test.ts (1 test) 3ms
 ✓ tests/AtImageUploader.test.ts (14 tests) 205ms
 ✓ tests/AtButton.test.ts (9 tests) 109ms
 ✓ tests/AtVirtualSelect.test.ts (14 tests) 279ms
 ✓ tests/AtSearchForm.test.ts (13 tests) 256ms
 ✓ tests/AtProTable.test.ts (15 tests) 321ms
 ✓ tests/AtEditableTable.test.ts (20 tests) 403ms

 Test Files  10 passed (10)
      Tests  113 passed (113)
```

## 偏差与风险
- 多入口由 Rollup 抽取共享模块，dist/index.js 不再是单体全量文件（850 B 转发入口），组件实现进入 12 个带 hash 的共享 chunk；这些 chunk 已包含在 npm 包内，全量与子路径导入均可正常解析。
- 共享 chunk 使用 hash 文件名，dist 文件数显著增加（32 → 58），后续如需固定命名需另行裁决。
- style.css 仍为单一文件（22.03 kB），未做按组件拆 CSS；未新增任何依赖。
- 未 commit、未 push，等待核对。
