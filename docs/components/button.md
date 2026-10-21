<script setup lang="ts">
import { ref } from 'vue'

import { AtButton } from '../../src/index'

const loading = ref(false)
function simulate() {
  loading.value = true
  setTimeout(() => (loading.value = false), 1500)
}
</script>

# AtButton 按钮

## 基础用法

三种变体与三种尺寸：

<div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap">
  <AtButton>主要按钮</AtButton>
  <AtButton variant="secondary">次要按钮</AtButton>
  <AtButton variant="text">文字按钮</AtButton>
</div>

<div style="display: flex; gap: 8px; align-items: center; margin-top: 16px">
  <AtButton size="sm">小</AtButton>
  <AtButton size="md">中</AtButton>
  <AtButton size="lg">大</AtButton>
</div>

```vue
<AtButton>主要按钮</AtButton>
<AtButton variant="secondary">次要按钮</AtButton>
<AtButton variant="text">文字按钮</AtButton>

<AtButton size="sm">小</AtButton>
<AtButton size="md">中</AtButton>
<AtButton size="lg">大</AtButton>
```

## 加载与禁用

loading 时自动禁用点击并显示加载指示：

<div style="display: flex; gap: 8px; align-items: center">
  <AtButton :loading="loading" @click="simulate">{{ loading ? '提交中' : '模拟提交' }}</AtButton>
  <AtButton disabled>禁用按钮</AtButton>
</div>

```vue
<AtButton :loading="loading" @click="simulate">模拟提交</AtButton>
<AtButton disabled>禁用按钮</AtButton>
```

## API

| 属性 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| variant | 变体 | `'primary' \| 'secondary' \| 'text'` | `'primary'` |
| size | 尺寸（高 28 / 32 / 40px） | `'sm' \| 'md' \| 'lg'` | `'md'` |
| disabled | 禁用 | `boolean` | `false` |
| loading | 加载中（自动禁用点击，置 `aria-busy`） | `boolean` | `false` |
| type | 原生 type | `'button' \| 'submit' \| 'reset'` | `'button'` |

| 事件 | 说明 | 参数 |
| --- | --- | --- |
| click | 非禁用且非加载时点击触发 | `MouseEvent` |

| 插槽 | 说明 |
| --- | --- |
| default | 按钮内容 |

其余原生属性（`class` / `style` / `data-*` / `aria-*`）透传至根 `<button>`。
