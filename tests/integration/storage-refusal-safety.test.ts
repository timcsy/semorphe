/**
 * 拒絕不等於丟掉（US3）
 *
 * ## 這支測試的第一個任務是「證明缺陷存在」
 *
 * `specs/052-storage-integrity-gate/research.md` F3 主張一條四步鏈：
 *
 *   1. `load()` 回傳 `null`
 *   2. 呼叫端的 `if (!state) return` **分不出**「沒有存檔」與「存檔被拒絕」
 *   3. 使用者以為是新的一頁，開始操作 → 觸發自動存檔
 *   4. `save()` 呼叫 `load()`，又拿到 `null`，於是所有欄位落到預設值 → **寫回去**
 *
 * **「拒絕載入」在四步之內變成「永久刪除」。**
 *
 * 那條鏈當時是**推理**——每一環都查證了程式碼，但沒有實際跑過。本檔的第一個
 * describe 就是把它跑出來。跑不出來的話，US3 的設計是建立在讀錯的程式碼上，
 * 要回頭改而不是照著寫。
 *
 * 見 specs/052-storage-integrity-gate/tasks.md T002
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { StorageService } from '../../src/core/storage'

const STORAGE_KEY = 'semorphe-state'

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
    raw: () => store,
  }
})()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

describe('設計前提：載不進來的存檔，會在下一次自動存檔時被抹掉', () => {
  let storage: StorageService

  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
    storage = new StorageService()
  })

  it('📌 現況缺陷：load() 回 null → save() 用預設值覆蓋 → 原資料消失', () => {
    // 一份載不進來的存檔。今天唯一會讓 load() 回 null 的情形是內容壞掉
    // （例如寫入途中被中斷）；加上版本閘門之後，「版本不符」也會走同一條路。
    const 原始內容 = '{"version":1,"code":"使用者的作品","lastMod'
    localStorage.setItem(STORAGE_KEY, 原始內容)

    // 第 1–2 步：載入拿到 null，呼叫端分不出「沒有存檔」與「載不進來」
    expect(storage.load()).toBeNull()

    // 第 3–4 步：使用者以為是新的一頁，動了一下 → 自動存檔
    storage.save({ code: 'int main(){}' })

    const 現在的內容 = localStorage.getItem(STORAGE_KEY)!

    // 這裡就是那條鏈的終點
    expect(現在的內容).not.toBe(原始內容)
    expect(現在的內容).not.toContain('使用者的作品')

    console.log(
      [
        '',
        '  📌 設計前提已驗證（research.md F3 的四步鏈確實會發生）',
        `     原始存檔：${原始內容}`,
        `     一次自動存檔之後：${現在的內容.slice(0, 60)}…`,
        '     原內容已無法復原。US3「先備份再拒絕」的設計成立。',
        '',
      ].join('\n'),
    )
  })

  it('📌 現況缺陷：連備份都沒有——原始字串沒有被留在任何地方', () => {
    localStorage.setItem(STORAGE_KEY, '{"version":1,"code":"使用者的作品"')
    storage.load()
    storage.save({ code: 'x' })

    const 所有的鍵 = Object.keys(localStorageMock.raw())
    const 有沒有備份 = 所有的鍵.some((k) => k !== STORAGE_KEY)

    expect(有沒有備份, `目前的鍵：${所有的鍵.join(', ')}`).toBe(false)
  })
})
