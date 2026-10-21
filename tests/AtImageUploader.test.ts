import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import AtImageUploader from '../src/components/AtImageUploader/AtImageUploader.vue'
import type { UploadItem } from '../src/components/AtImageUploader/types'

enableAutoUnmount(afterEach)

const originalUrlStatics = {
  createObjectURL: Object.getOwnPropertyDescriptor(URL, 'createObjectURL'),
  revokeObjectURL: Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL'),
}

let patchedUrlStatics = false

/** 固定 createObjectURL 的返回值，并返回 revoke 的 spy */
function patchUrlStatics(): ReturnType<typeof vi.fn> {
  let seed = 0
  const revoke = vi.fn()

  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: () => {
      seed += 1
      return `blob:atlas-${seed}`
    },
  })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke })
  patchedUrlStatics = true

  return revoke
}

function restoreUrlStatics() {
  if (!patchedUrlStatics) return
  patchedUrlStatics = false

  for (const key of ['createObjectURL', 'revokeObjectURL'] as const) {
    const descriptor = originalUrlStatics[key]
    if (descriptor) Object.defineProperty(URL, key, descriptor)
    else
      delete (
        URL as unknown as { createObjectURL?: unknown; revokeObjectURL?: unknown }
      )[key]
  }
}

afterEach(() => {
  restoreUrlStatics()
  vi.restoreAllMocks()
})

function mountUploader(props: Record<string, unknown> = {}) {
  return mount(AtImageUploader, {
    props: { modelValue: [], ...props },
  })
}

function makeItem(uid: string, patch: Partial<UploadItem> = {}): UploadItem {
  return { uid, name: `${uid}.jpg`, size: 1024, type: 'image/jpeg', status: 'done', ...patch }
}

function makeFile(name: string, size: number, type: string): File {
  return new File([new Uint8Array(size)], name, { type })
}

async function selectFiles(
  wrapper: ReturnType<typeof mountUploader>,
  files: File[],
): Promise<void> {
  const input = wrapper.find('input[type="file"]')
  Object.defineProperty(input.element, 'files', { configurable: true, value: files })
  await input.trigger('change')
  await flushPromises()
}

describe('AtImageUploader 选择与校验', () => {
  it('选择合法文件后进入列表并 emit upload（状态 ready）', async () => {
    const wrapper = mountUploader({ compress: false })

    await selectFiles(wrapper, [makeFile('a.png', 2048, 'image/png')])

    expect(wrapper.findAll('.at-image-uploader__item')).toHaveLength(1)

    const upload = wrapper.emitted('upload')
    expect(upload).toHaveLength(1)
    expect(upload![0][0]).toMatchObject({ name: 'a.png', size: 2048, status: 'ready' })

    const lastModel = wrapper.emitted('update:modelValue')!.at(-1)![0] as UploadItem[]
    expect(lastModel[0].status).toBe('ready')
  })

  it('类型不符时 emit error，列表不增加', async () => {
    const wrapper = mountUploader()

    await selectFiles(wrapper, [makeFile('note.txt', 100, 'text/plain')])

    expect(wrapper.findAll('.at-image-uploader__item')).toHaveLength(0)

    const error = wrapper.emitted('error')
    expect(error).toHaveLength(1)
    expect(error![0][0]).toMatchObject({
      message: expect.stringContaining('文件类型不支持'),
    })
  })

  it('超过 maxSize 时 emit error', async () => {
    const wrapper = mountUploader({ maxSize: 1024 })

    await selectFiles(wrapper, [makeFile('big.png', 2048, 'image/png')])

    expect(wrapper.findAll('.at-image-uploader__item')).toHaveLength(0)

    const error = wrapper.emitted('error')
    expect(error).toHaveLength(1)
    expect(error![0][0]).toMatchObject({
      message: expect.stringContaining('1.0 KB'),
    })
  })

  it('达到 maxCount 后上传区隐藏', () => {
    const wrapper = mountUploader({
      modelValue: [makeItem('a'), makeItem('b')],
      maxCount: 2,
    })

    expect(wrapper.find('.at-image-uploader__dropzone').exists()).toBe(false)
  })
})

describe('AtImageUploader 交互', () => {
  it('删除卡片 emit remove 且 update:modelValue 少一项', async () => {
    const wrapper = mountUploader({ modelValue: [makeItem('a'), makeItem('b')] })

    await wrapper.findAll('.at-image-uploader__remove')[0].trigger('click')

    expect(wrapper.emitted('remove')).toHaveLength(1)
    expect(wrapper.findAll('.at-image-uploader__item')).toHaveLength(1)

    const lastModel = wrapper.emitted('update:modelValue')!.at(-1)![0] as UploadItem[]
    expect(lastModel.map((item) => item.uid)).toEqual(['b'])
  })

  it('error 项点重试 → 状态回到 ready 并 emit retry 与 upload', async () => {
    const wrapper = mountUploader({
      modelValue: [makeItem('broken', { status: 'error', message: '上传失败：网络中断' })],
    })

    await wrapper.find('.at-image-uploader__retry').trigger('click')

    expect(wrapper.emitted('retry')).toHaveLength(1)
    expect(wrapper.emitted('upload')).toHaveLength(1)

    const lastModel = wrapper.emitted('update:modelValue')!.at(-1)![0] as UploadItem[]
    expect(lastModel[0]).toMatchObject({ status: 'ready', message: undefined })
  })

  it('上传中渲染 progress 条', () => {
    const wrapper = mountUploader({
      modelValue: [makeItem('uploading', { status: 'uploading', progress: 40 })],
    })

    expect(wrapper.find('.at-image-uploader__progress').attributes('aria-valuenow')).toBe('40')
    expect(wrapper.find('.at-image-uploader__progress-bar').attributes('style')).toContain(
      'width: 40%',
    )
  })

  it('上移/下移按钮改变顺序并 emit update:modelValue', async () => {
    const wrapper = mountUploader({
      modelValue: [makeItem('a'), makeItem('b'), makeItem('c')],
    })

    await wrapper.findAll('.at-image-uploader__item')[1].find('[aria-label="下移"]').trigger('click')

    let lastModel = wrapper.emitted('update:modelValue')!.at(-1)![0] as UploadItem[]
    expect(lastModel.map((item) => item.uid)).toEqual(['a', 'c', 'b'])

    await wrapper.findAll('.at-image-uploader__item')[2].find('[aria-label="上移"]').trigger('click')

    lastModel = wrapper.emitted('update:modelValue')!.at(-1)![0] as UploadItem[]
    expect(lastModel.map((item) => item.uid)).toEqual(['a', 'b', 'c'])
  })

  it('disabled 时不能选择文件', async () => {
    const wrapper = mountUploader({ disabled: true })

    const input = wrapper.find('input[type="file"]')
    const clickSpy = vi.spyOn(input.element as HTMLInputElement, 'click')

    expect((input.element as HTMLInputElement).disabled).toBe(true)
    expect(wrapper.find('.at-image-uploader__dropzone').attributes('tabindex')).toBe('-1')

    await wrapper.find('.at-image-uploader__dropzone').trigger('click')

    expect(clickSpy).not.toHaveBeenCalled()
  })

  it('Canvas 不可用时不崩，退化为原文件', async () => {
    const original = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: () => '',
    })

    try {
      const wrapper = mountUploader()

      await selectFiles(wrapper, [makeFile('raw.png', 4096, 'image/png')])

      const upload = wrapper.emitted('upload')
      expect(upload).toHaveLength(1)
      expect(upload![0][0]).toMatchObject({ size: 4096, status: 'ready', url: undefined })
    } finally {
      if (original) {
        Object.defineProperty(URL, 'createObjectURL', original)
      } else {
        delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL
      }
    }
  })
})

describe('AtImageUploader blob URL 生命周期', () => {
  it('删除一张图后 revoke 被调用且参数是该图的 blob url', async () => {
    const revoke = patchUrlStatics()
    const wrapper = mountUploader({ compress: false })

    await selectFiles(wrapper, [makeFile('a.png', 512, 'image/png')])

    const item = (wrapper.emitted('update:modelValue')!.at(-1)![0] as UploadItem[])[0]
    expect(item.url).toBe('blob:atlas-1')

    await wrapper.find('.at-image-uploader__remove').trigger('click')

    expect(revoke).toHaveBeenCalledTimes(1)
    expect(revoke).toHaveBeenCalledWith('blob:atlas-1')
  })

  it('挂载 2 张图后卸载组件，revoke 被调用 2 次', async () => {
    const revoke = patchUrlStatics()
    const wrapper = mountUploader({ compress: false })

    await selectFiles(wrapper, [
      makeFile('a.png', 512, 'image/png'),
      makeFile('b.png', 512, 'image/png'),
    ])
    expect(wrapper.emitted('upload')).toHaveLength(2)

    wrapper.unmount()

    expect(revoke).toHaveBeenCalledTimes(2)
    expect(revoke).toHaveBeenCalledWith('blob:atlas-1')
    expect(revoke).toHaveBeenCalledWith('blob:atlas-2')
  })

  it('父组件把 modelValue 清空，revoke 被调用', async () => {
    const revoke = patchUrlStatics()
    const wrapper = mountUploader({ compress: false })

    await selectFiles(wrapper, [
      makeFile('a.png', 512, 'image/png'),
      makeFile('b.png', 512, 'image/png'),
    ])
    expect(wrapper.findAll('.at-image-uploader__item')).toHaveLength(2)

    await wrapper.setProps({ modelValue: [] })

    expect(revoke).toHaveBeenCalledTimes(2)
  })

  it('父组件传入的 https:// 地址在删除时不被 revoke', async () => {
    const revoke = patchUrlStatics()
    const wrapper = mountUploader({
      modelValue: [makeItem('remote', { url: 'https://cdn.example.com/a.jpg' })],
    })

    await wrapper.find('.at-image-uploader__remove').trigger('click')

    expect(wrapper.emitted('remove')).toHaveLength(1)
    expect(revoke).not.toHaveBeenCalled()
  })
})
