import process from 'node:process'

import { defineConfig } from 'vitepress'

export default defineConfig({
  // GitHub Pages 是子路径部署：CI 构建必须带 /atlas-ui/ 前缀，本地仍走根路径
  base: process.env.GITHUB_ACTIONS ? '/atlas-ui/' : '/',
  title: 'atlas-ui',
  description: '一套补足 Element Plus 空白的 Vue 3 后台业务组件库',
  themeConfig: {
    nav: [{ text: '组件', link: '/components/button' }],
    sidebar: [
      {
        text: '组件',
        items: [
          { text: 'AtButton 按钮', link: '/components/button' },
          { text: 'AtProTable 数据表格', link: '/components/pro-table' },
          { text: 'AtSearchForm 查询表单', link: '/components/search-form' },
          { text: 'AtEditableTable 行内编辑表格', link: '/components/editable-table' },
          { text: 'AtVirtualSelect 虚拟滚动选择器', link: '/components/virtual-select' },
          { text: 'AtImageUploader 图片上传', link: '/components/image-uploader' },
        ],
      },
    ],
  },
})
