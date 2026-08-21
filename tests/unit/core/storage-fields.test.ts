/**
 * @vitest-environment happy-dom
 *
 * ⚠️ **預設環境是 `node`**（2026-08-21，見 `vitest.config.ts` 的說明）——
 * 這個檔碰得到 DOM（`document`／`localStorage`／面板），所以顯式加回來。
 */
/**
 * 欄位守恆（US1）
 *
 * 存檔格式宣告的每一個欄位，存進去必須載得回來。
 *
 * ## 為什麼需要這支測試——修法明明已經讓它不可能發生
 *
 * 修法是把逐欄位列舉改成展開合併，**結構上**不可能漏欄位。那為什麼還要測？
 *
 * 因為這支測試守的是**別的東西**：有人日後把展開改回列舉、或在合併之後又
 * 加了會丟欄位的處理。修法消除的是今天的 bug，測試守的是明天的。
 *
 * ## 欄位清單為什麼不寫在這裡
 *
 * 寫在這裡就會變成第二份真相，而且會無聲漂移——那正是這個功能要治的病。
 * 清單來自 `SAVED_STATE_FIELDS`，由 `satisfies` 釘住，漏一個就編不過。
 *
 * 見 specs/052-storage-integrity-gate/data-model.md 契約 1、5
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { StorageService } from '../../../src/core/storage'
import { SAVED_STATE_FIELDS } from '../../../src/core/storage-version'
import type { SavedState } from '../../../src/core/storage'
import { CURRENT_VERSION } from '../../../src/core/storage-version'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

/** 每個欄位一個**可辨識**的值——用預設值的話，「丟了」與「存對了」會長得一樣 */
const filledState: SavedState = {
  version: CURRENT_VERSION,
  tree: null,
  blocklyState: { blocks: { languageVersion: 0, blocks: [] } },
  code: 'int main(){ return 0; }',
  language: 'cpp',
  styleId: 'google',
  topicId: 'apcs-basic',
  targetId: 'c',
  enabledBranches: ['a', 'b'],
  lastModified: '2026-08-06T00:00:00.000Z',
  blockStyleId: 'zelos',
  locale: 'en',
}

/** 這些欄位由存檔層自己決定，不該與存入值相同 */
const systemRewrittenFields = new Set(['lastModified'])

describe('欄位守恆：存檔格式宣告的每個欄位都載得回來', () => {
  let storage: StorageService

  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
    storage = new StorageService()
  })

  it('填滿所有欄位存進去，每一個都載得回來', () => {
    storage.save(filledState)
    const loaded = storage.load()
    expect(loaded, '存進去之後載不回來——連存檔本身都不見了').not.toBeNull()

    // 失敗訊息必須說得出**是哪個欄位**（FR-003）——只說「不相等」的話，
    // 讀的人還得自己去查是哪一個。
    const lostOnes: string[] = []
    for (const field of Object.keys(SAVED_STATE_FIELDS) as (keyof SavedState)[]) {
      if (systemRewrittenFields.has(field)) continue
      const store = filledState[field]
      const loadBack = loaded![field]
      if (JSON.stringify(loadBack) !== JSON.stringify(store)) {
        lostOnes.push(`${field}（存入 ${JSON.stringify(store)}，載回 ${JSON.stringify(loadBack)}）`)
      }
    }

    expect(lostOnes, `以下欄位沒有守恆：\n  - ${lostOnes.join('\n  - ')}`).toEqual([])
  })

  it('清單本身是完整的——不是只測了幾個好測的欄位', () => {
    // 這支守的是「有人把 SAVED_STATE_FIELDS 縮水好讓上面那支通過」
    // ⚠️ 11 → 12（2026-08-17，spec 136）：新增 `targetId`，見 storage-version.test.ts 的說明。
    expect(Object.keys(SAVED_STATE_FIELDS).length).toBe(12)
    expect(Object.keys(filledState).length).toBe(Object.keys(SAVED_STATE_FIELDS).length)
  })

  it('選填欄位：「未提供」與「提供了但為空」可區分（FR-004）', () => {
    storage.save({ ...filledState, blockStyleId: 'zelos' })
    storage.save({ code: 'x' }) // 沒提供 blockStyleId
    expect(
      storage.load()!.blockStyleId,
      '「這次沒提供」不該抹掉「上次存的值」',
    ).toBe('zelos')

    storage.save({ blockStyleId: '' }) // 提供了，值是空字串
    expect(storage.load()!.blockStyleId, '明確存入的空值必須被保留').toBe('')
  })

  it('存檔中不認得的額外欄位會被保留（FR-017）', () => {
    storage.save(filledState)
    const raw = JSON.parse(localStorage.getItem('semorphe-state')!)
    localStorage.setItem('semorphe-state', JSON.stringify({ ...raw, futureFields: 42 }))

    storage.save({ code: '又改了一次' })
    const after = JSON.parse(localStorage.getItem('semorphe-state')!)
    expect(after.futureFields, '未知欄位在下一次存檔後被抹掉了').toBe(42)
  })
})
