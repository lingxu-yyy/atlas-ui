export type UploadStatus = 'reading' | 'ready' | 'uploading' | 'done' | 'error'

/** 上传项由父组件的 v-model 持有，组件只 emit 不修改 */
export interface UploadItem {
  uid: string
  name: string
  size: number
  type: string
  status: UploadStatus
  url?: string
  /** 父组件上传进度，0 - 100 */
  progress?: number
  /** error 状态下的中文原因 */
  message?: string
}

export interface AtImageUploaderProps {
  modelValue: UploadItem[]
  maxCount?: number
  maxSize?: number
  accept?: string
  compress?: boolean
  compressMaxWidth?: number
  quality?: number
  disabled?: boolean
  sortable?: boolean
}

export interface AtImageUploaderErrorPayload {
  item: UploadItem
  message: string
}
