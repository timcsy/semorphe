/**
 * @vitest-environment happy-dom
 *
 * ⚠️ **預設環境是 `node`**（2026-08-21，見 `vitest.config.ts` 的說明）——
 * 這個檔碰得到 DOM（`document`／`localStorage`／面板），所以顯式加回來。
 */
/**
 * 拒絕不等於丟掉（US3）
 *
 * ## 這個功能唯一能讓事情比現況更糟的方式
 *
 * 加嚴版本閘門之後，判錯的代價是**使用者的作品**。所以「拒絕」必須是明確的、
 * 可見的、而且**不破壞原資料**的。
 *
 * ## 設計前提已經先被實測驗證過
 *
 * `research.md` F3 主張一條四步鏈：
 *
 *   1. `load()` 回傳 `null`
 *   2. 呼叫端的 `if (!state) return` **分不出**「沒有存檔」與「存檔被拒絕」
 *   3. 使用者以為是新的一頁，開始操作 → 觸發自動存檔
 *   4. `save()` 呼叫 `load()`，又拿到 `null`，所有欄位落到預設值 → **寫回去**
 *
 * 那條鏈當時是推理。實作的第一件事就是把它跑出來——**跑出來了**（原始存檔
 * 在一次自動存檔之後無法復原，而且沒有留在任何地方）。所以下面的設計成立：
 * **拒絕之前先把原始內容搬到備份鍵。**
 *
 * 見 specs/052-storage-integrity-gate/tasks.md T002、T025–T026
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { StorageService } from '../../src/core/storage'

const STORAGE_KEY = 'semorphe-state'
const BACKUP_KEY = 'semorphe-state.rejected'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  let keyThatFailsWrite: string | null = null
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      if (key === keyThatFailsWrite) throw new Error('QuotaExceededError')
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
      keyThatFailsWrite = null
    }),
    failedAt: (key: string | null) => {
      keyThatFailsWrite = key
    },
    raw: () => store,
  }
})()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

/** 一份版本高於當前、因此會被拒絕的存檔 */
const futureSave = JSON.stringify({
  version: 99,
  tree: null,
  blocklyState: {},
  code: '使用者在另一台裝置寫的作品',
  language: 'cpp',
  styleId: 'apcs',
  lastModified: '2026-08-06T00:00:00.000Z',
})

describe('拒絕不等於丟掉', () => {
  let storage: StorageService

  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
    storage = new StorageService()
  })

  it('拒絕之後再自動存檔，原始內容仍完整存在於備份鍵（T025）', () => {
    localStorage.setItem(STORAGE_KEY, futureSave)

    // 第 1–2 步：載入被拒絕，而且呼叫端**問得出來**為什麼
    const r = storage.loadOutcome()
    expect(r.kind).toBe('refused')
    expect(r.kind === 'refused' && r.backedUpTo).toBe(BACKUP_KEY)

    // 第 3–4 步：使用者以為是新的一頁，動了一下 → 自動存檔
    storage.save({ code: 'int main(){}' })

    // 主鍵確實被新的工作蓋過去了——那是對的，使用者的新工作要存得了
    expect(localStorage.getItem(STORAGE_KEY)).toContain('int main(){}')

    // 但原始內容沒有消失
    expect(localStorage.getItem(BACKUP_KEY)).toBe(futureSave)
    expect(localStorage.getItem(BACKUP_KEY)).toContain('使用者在另一台裝置寫的作品')
  })

  it('備份寫不進去時，仍然回報拒絕，且說得出沒有備份成功（T026）', () => {
    localStorage.setItem(STORAGE_KEY, futureSave)
    localStorageMock.failedAt(BACKUP_KEY)

    const r = storage.loadOutcome()

    expect(r.kind, '備份失敗不得變成「載入成功」').toBe('refused')
    expect(
      r.kind === 'refused' && r.backedUpTo,
      '備份沒寫成功卻回報備份好了，比沒有備份更危險',
    ).toBe('')

    // 這條路徑上主鍵完全不動
    expect(localStorage.getItem(STORAGE_KEY)).toBe(futureSave)
  })

  it('拒絕的理由分得出四種，不是一句「載入失敗」', () => {
    const cases: [string, string, string][] = [
      ['版本較高', futureSave, 'too-new'],
      ['不是存檔', JSON.stringify({ hello: 'world' }), 'not-a-save'],
      ['壞掉的 JSON', '{"version":1,"code":"截斷了', 'not-a-save'],
      [
        '版本較低且無升級路徑',
        JSON.stringify({
          version: 0, tree: null, blocklyState: {}, code: 'x',
          language: 'cpp', styleId: 'apcs', lastModified: 'now',
        }),
        'no-upgrade-path',
      ],
    ]

    for (const [name, raw, expect2] of cases) {
      localStorageMock.clear()
      localStorage.setItem(STORAGE_KEY, raw)
      const r = storage.loadOutcome()
      expect(r.kind, `${name}：應被拒絕`).toBe('refused')
      expect(r.kind === 'refused' && r.reason.code, `${name} 的理由判錯`).toBe(expect2)
    }
  })

  it('合法存檔不受影響——沒有多出備份鍵（不誤傷）', () => {
    storage.save({ code: 'int x = 5;' })
    storage.load()
    expect(Object.keys(localStorageMock.raw())).toEqual([STORAGE_KEY])
  })

  it('沒有存檔時是 empty，與「被拒絕」分得開', () => {
    expect(storage.loadOutcome().kind).toBe('empty')
    expect(Object.keys(localStorageMock.raw())).toEqual([])
  })
})
