# atlas-ui

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

一套补足 Element Plus 空白的 Vue 3 后台业务组件库（零运行时依赖，纯 Vue 3 + TypeScript 自研）。当前全量产物 index.js 1.21KB（gzip 0.62KB）。

## 组件清单

| 组件 | 说明 | 状态 |
| --- | --- | --- |
| AtButton | 按钮（加载态 / 尺寸 / 变体） | Roadmap |
| AtProTable | 业务表格（列配置 / 分页 / 空态 / 加载 / 列显隐） | Roadmap |
| AtSearchForm | 高级搜索表单（与 AtProTable 共用字段 schema） | Roadmap |
| AtEditableTable | 行内编辑表格（字段级校验 / 脏行标记 / 批量保存） | Roadmap |
| AtVirtualSelect | 虚拟滚动选择器（万级数据 / 远程搜索 / 多选 / 键盘导航） | Roadmap |
| AtImageUploader | 图片上传（拖拽 / Canvas 裁剪 / 压缩 / 失败重试） | Roadmap |

不进 v0.x 的候选：AtStatusTag、AtPageHeader、AtDialog（理由：体量过小或与现有方案无差异化）。

## 快速开始

```bash
git clone git@github.com:lingxu-yyy/atlas-ui.git
cd atlas-ui && pnpm install
pnpm docs:dev
```

## 开发约定

- 包管理器：**pnpm >= 12**（packageManager 字段已固定 12.14.0，CI 与本地必须一致）
- 依赖构建脚本白名单写在 `pnpm-workspace.yaml` 的 `allowBuilds` 中（pnpm 12 起 package.json 的 pnpm 字段不再生效）；新增白名单用 `pnpm approve-builds <pkg>` 并在提交信息说明原因
- 组件样式只允许使用 `src/styles/tokens.css` 中的设计 token，不写裸值
- 提交信息遵循中文 Conventional Commits

## 浏览器要求

使用了 `color-mix()` 等现代 CSS 特性，最低版本：Chrome 111 / Safari 16.2 / Firefox 113。

## 在线 Demo

TODO（将部署至 GitHub Pages）

## License

[MIT](./LICENSE)
