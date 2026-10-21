/**
 * 商品筛选用例。
 *
 * 这个用例证明协议覆盖了什么：
 * - 搜索区与表格列共用同一份字段定义（商品名既搜又列）
 * - 显式关闭搜索（SKU 只展示不搜）
 * - 枚举筛选（类目）
 * - 数值范围筛选（价格区间，min 约束）
 * - 时间区间筛选（上架时间）
 * - 库存数值列
 * - 布尔筛选（是否在售）
 * - 多值枚举（标签，用 select multiple 表达多选语义）
 */
import type { FieldDef } from '../../src/types/schema'

export const productFields: FieldDef[] = [
  {
    key: 'name',
    label: '商品名',
    type: 'text',
    searchable: true,
    width: 200,
  },
  {
    key: 'sku',
    label: 'SKU',
    type: 'text',
    searchable: false,
    width: 160,
  },
  {
    key: 'category',
    label: '类目',
    type: 'select',
    width: 120,
    options: [
      { label: '数码', value: 'digital' },
      { label: '家居', value: 'home' },
      { label: '服饰', value: 'fashion' },
    ],
  },
  {
    key: 'price',
    label: '价格区间',
    type: 'number',
    min: 0,
    precision: 2,
    unit: '元',
    width: 120,
    column: { sortable: true },
  },
  {
    key: 'listedAt',
    label: '上架时间',
    type: 'date',
    range: true,
    format: 'YYYY-MM-DD',
    width: 180,
  },
  {
    key: 'stock',
    label: '库存',
    type: 'number',
    unit: '件',
    width: 100,
  },
  {
    key: 'onSale',
    label: '是否在售',
    type: 'boolean',
    trueText: '在售',
    falseText: '下架',
    width: 100,
  },
  {
    key: 'tags',
    label: '标签',
    type: 'select',
    multiple: true,
    filterable: true,
    options: [
      { label: '热销', value: 'hot' },
      { label: '新品', value: 'new' },
      { label: '清仓', value: 'clearance' },
    ],
  },
]
