/**
 * 订单列表用例。
 *
 * 这个用例证明协议覆盖了什么：
 * - 只读信息列（订单号，不参与搜索）
 * - 时间区间查询（下单时间 range）
 * - 带单位与精度的数值列（商品数 / 订单金额）
 * - 枚举查询与展示（支付方式 / 订单状态）
 * - 布尔标记（是否加急，自定义真值文案）
 * - 带长度约束的自由文本（备注）
 * - 自定义操作列（render 返回 VNode）
 */
import { h } from 'vue'

import type { FieldDef } from '../../src/types/schema'

export const orderFields: FieldDef[] = [
  {
    key: 'orderNo',
    label: '订单号',
    type: 'text',
    width: 180,
    searchable: false,
    column: { sortable: true, fixed: 'left' },
  },
  {
    key: 'createdAt',
    label: '下单时间',
    type: 'date',
    range: true,
    format: 'YYYY-MM-DD HH:mm',
    width: 180,
  },
  {
    key: 'customerName',
    label: '客户名',
    type: 'text',
    width: 120,
  },
  {
    key: 'itemCount',
    label: '商品数',
    type: 'number',
    unit: '件',
    width: 100,
  },
  {
    key: 'amount',
    label: '订单金额',
    type: 'number',
    precision: 2,
    unit: '元',
    width: 120,
    column: { sortable: true },
  },
  {
    key: 'paymentMethod',
    label: '支付方式',
    type: 'select',
    width: 120,
    options: [
      { label: '微信', value: 'wechat' },
      { label: '支付宝', value: 'alipay' },
      { label: '银行卡', value: 'bankcard' },
    ],
  },
  {
    key: 'status',
    label: '订单状态',
    type: 'select',
    width: 120,
    options: [
      { label: '待付款', value: 'pending' },
      { label: '已发货', value: 'shipped' },
      { label: '已完成', value: 'completed' },
      { label: '已取消', value: 'cancelled' },
    ],
  },
  {
    key: 'urgent',
    label: '是否加急',
    type: 'boolean',
    trueText: '加急',
    width: 100,
  },
  {
    key: 'remark',
    label: '备注',
    type: 'text',
    maxLength: 100,
    hint: '最多 100 字',
  },
  {
    key: 'actions',
    label: '操作',
    type: 'custom',
    width: 140,
    align: 'center',
    column: { fixed: 'right' },
    render: (_value, row) => h('button', { type: 'button' }, `查看 ${String(row.orderNo ?? '')}`),
  },
]
