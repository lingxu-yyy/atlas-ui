import { describe, expect, it } from 'vitest'

import * as atlas from '../src/index'

describe('atlas-ui 工程骨架', () => {
  it('包入口可正常导入', () => {
    expect(atlas).toBeDefined()
  })
})
