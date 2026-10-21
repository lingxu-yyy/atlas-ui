import { defineConfig } from 'vitepress'

export default defineConfig({
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
        ],
      },
    ],
  },
})
