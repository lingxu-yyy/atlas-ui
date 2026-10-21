/**
 * 用户列表用例。
 *
 * 这个用例证明协议覆盖了什么：
 * - 纯展示标识（用户 ID）
 * - 自由文本（昵称）
 * - 带校验规则的字段（手机号 pattern + message）
 * - 单值日期（注册时间、最近登录，非区间）
 * - 枚举展示（会员等级）
 * - 数值展示（积分）
 * - 布尔状态映射为中文文案（正常 / 禁用）
 */
import type { FieldDef } from '../../src/types/schema'

export const userFields: FieldDef[] = [
  {
    key: 'userId',
    label: '用户 ID',
    type: 'text',
    width: 120,
    searchable: false,
  },
  {
    key: 'nickname',
    label: '昵称',
    type: 'text',
    width: 140,
  },
  {
    key: 'phone',
    label: '手机号',
    type: 'text',
    maxLength: 11,
    width: 140,
    rules: [
      {
        pattern: /^1[3-9]\d{9}$/,
        message: '请输入 11 位手机号',
        trigger: 'blur',
      },
    ],
  },
  {
    key: 'registeredAt',
    label: '注册时间',
    type: 'date',
    format: 'YYYY-MM-DD',
    width: 160,
  },
  {
    key: 'level',
    label: '会员等级',
    type: 'select',
    width: 120,
    options: [
      { label: '普通会员', value: 'normal' },
      { label: '白银会员', value: 'silver' },
      { label: '黄金会员', value: 'gold' },
    ],
  },
  {
    key: 'points',
    label: '积分',
    type: 'number',
    precision: 0,
    width: 100,
    column: { sortable: true },
  },
  {
    key: 'status',
    label: '状态',
    type: 'boolean',
    trueText: '正常',
    falseText: '禁用',
    width: 100,
  },
  {
    key: 'lastLoginAt',
    label: '最近登录',
    type: 'date',
    format: 'YYYY-MM-DD HH:mm',
    width: 160,
  },
]
