export interface AtButtonProps {
  /** 变体：实底主色 / 描边 / 纯文字 */
  variant?: 'primary' | 'secondary' | 'text'
  /** 尺寸：28 / 32 / 40px 高度 */
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  /** 加载中：显示 spinner、自动禁用点击、aria-busy="true" */
  loading?: boolean
  /** 原生 type，默认 button，防止在 form 中意外提交 */
  type?: 'button' | 'submit' | 'reset'
}
