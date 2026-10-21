# Changelog

## 0.1.0

首个可用版本。

### 组件
- AtButton：3 variant × 3 size，loading 态自动禁用
- AtProTable：字段驱动列定义、三态排序、列显隐、受控分页、骨架屏
- AtSearchForm：与表格共用 FieldDef[]，条件自动映射为 like/eq/in/between
- AtEditableTable：按 rowKey 存储草稿、脏行标记、异步校验、跨页脏行保留
- AtVirtualSelect：固定行高虚拟滚动、usePopover 定位、远程搜索防抖
- AtImageUploader：Canvas 压缩、拖拽排序、blob URL 生命周期管理

### 基础设施
- 字段协议冻结：FieldDef 判别式联合 + renderer registry + design token
- CI：lint / typecheck / test / build / docs:build
- 文档站部署到 GitHub Pages
