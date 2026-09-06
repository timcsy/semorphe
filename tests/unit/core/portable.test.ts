/**
 * **一份帶得走的作品**——拆開與組回來（spec 177）。
 *
 * ⚠️ 這裡不碰 zip：核心說「拆成哪幾個檔」，宿主說「怎麼變成一個下載」。
 */
import { describe, it, expect } from 'vitest'
import { toPortable, fromPortable, defaultWorkName, SIDECAR_DIR } from '../../../src/core/portable'
import type { SavedState } from '../../../src/core/storage'

const STATE = {
  version: 18,
  code: '#include <iostream>\nint main() { return 0; }\n',
  language: 'cpp',
  styleId: 'iostream',
  topicId: 'hello',
  lastModified: '2026-09-06T00:00:00.000Z',
  blocklyState: { blocks: { blocks: [{ type: 'cpp_program', x: 10, y: 20 }] } },
  codeHash: 'abc123',
  flowLayout: [{ keys: ['a'], x: 1, y: 2 }],
} as unknown as SavedState

describe('拆開：原始碼是第一級的檔案', () => {
  it('SC-001／SC-002：原始碼檔的內容逐字是程式碼，不含 JSON 包裝', () => {
    const files = toPortable(STATE, '作品', '.cpp')
    expect(files['作品.cpp']).toBe(STATE.code)
    expect(files['作品.cpp']!.startsWith('{'), '🔴 原始碼檔是 JSON → 別的編輯器打開看到的不是程式').toBe(false)
  })

  it('側檔在 `.semorphe/` 底下，而路徑帶著原始碼的檔名', () => {
    const files = toPortable(STATE, '作品', '.cpp')
    expect(Object.keys(files).sort()).toEqual(['.semorphe/作品.cpp.json', '作品.cpp'])
    expect(SIDECAR_DIR).toBe('.semorphe')
  })

  /**
   * 🔴 **`code` 不得在兩個地方各一份。**
   *
   * > **一份資料如果在容器裡出現兩次，那個容器就有兩個真相
   * > ——而它們只在有人編輯過其中一份之後才會不一樣。**
   */
  it('🔴 硬性零：側檔裡沒有 `code`', () => {
    const files = toPortable(STATE, 'w', '.cpp')
    const side = JSON.parse(files['.semorphe/w.cpp.json']!) as Record<string, unknown>
    expect(side['code'], '🔴 程式碼在容器裡出現兩次 → 兩個真相').toBeUndefined()
  })

  it('⚠️ 而 `language` **留在側檔裡**——副檔名暗示得到它，但反推是錯的', () => {
    const side = JSON.parse(toPortable(STATE, 'w', '.cpp')['.semorphe/w.cpp.json']!) as Record<string, unknown>
    expect(side['language']).toBe('cpp')
    expect(side['blocklyState']).toBeTruthy()
    expect(side['flowLayout']).toBeTruthy()
  })

  it('SC-003：副檔名換了，兩個檔名都跟著換', () => {
    expect(Object.keys(toPortable(STATE, 'w', '.py')).sort())
      .toEqual(['.semorphe/w.py.json', 'w.py'])
  })

  it('程式碼是空的照樣拆得出來，不得崩', () => {
    const files = toPortable({ ...STATE, code: '' } as SavedState, 'w', '.cpp')
    expect(files['w.cpp']).toBe('')
  })
})

describe('組回來', () => {
  it('SC-005：來回一趟，程式碼與側檔都對得回去', () => {
    const files = toPortable(STATE, '作品', '.cpp')
    const parts = fromPortable(files)
    expect(parts?.code).toBe(STATE.code)
    const side = JSON.parse(parts!.sideCar!) as Record<string, unknown>
    expect(side['flowLayout']).toEqual(STATE.flowLayout)
    expect(side['blocklyState']).toEqual(STATE.blocklyState)
  })

  /**
   * 🟢 **SC-008：側檔不在不是壞掉。**
   *
   * 有人在別的編輯器改過、把 `.semorphe/` 刪了。
   */
  it('SC-008：只有原始碼 → 拿得到程式碼，側檔是 null（不是錯誤）', () => {
    const parts = fromPortable({ 'w.cpp': 'int main(){}' })
    expect(parts).not.toBeNull()
    expect(parts!.code).toBe('int main(){}')
    expect(parts!.sideCar).toBeNull()
  })

  it('沒有原始碼的容器 → null（那不是一份作品）', () => {
    expect(fromPortable({ '.semorphe/w.cpp.json': '{}' })).toBeNull()
    expect(fromPortable({})).toBeNull()
  })

  it('★ 側檔用**檔名**配對——多檔案那天這裡不必重寫', () => {
    const parts = fromPortable({
      'w.cpp': 'A',
      '.semorphe/w.cpp.json': '{"tag":"right"}',
      '.semorphe/other.cpp.json': '{"tag":"wrong"}',
    })
    expect(JSON.parse(parts!.sideCar!)).toEqual({ tag: 'right' })
  })
})

describe('作品的預設名字', () => {
  it('用課程 id ＋ 日期，而不是發明一個檔名欄位', () => {
    expect(defaultWorkName('hello')).toMatch(/^hello-\d{4}-\d{2}-\d{2}$/)
  })

  it('沒有課程時有中性的預設', () => {
    expect(defaultWorkName(undefined)).toMatch(/^semorphe-\d{4}-\d{2}-\d{2}$/)
  })

  it('★ 課程 id 帶了檔名不安全的字 → 濾掉，不得造出一個壞路徑', () => {
    expect(defaultWorkName('a/b c..d')).toMatch(/^abcd-\d{4}/)
    expect(defaultWorkName('///')).toMatch(/^semorphe-/)
  })
})
