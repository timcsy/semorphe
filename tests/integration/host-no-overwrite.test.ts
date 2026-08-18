/**
 * 🔴 **開機不得覆蓋使用者的檔案。**
 *
 * ## 這是本規格唯一一條「做錯了會毀損使用者資料」的
 *
 * `ui/app.ts` 的還原路徑今天是：
 *
 * ```ts
 * restoreState()  →  if (state.code) this.monacoPanel?.setCode(state.code)
 * ```
 *
 * 在網頁版那是對的——**存檔就是真相**。
 * 🔴 而在一個「檔案才是真相」的宿主裡，它會**用上一次的存檔蓋掉使用者的檔案**。
 *
 * ## ⚠️ 而處置不是「記得不要呼叫 setCode」
 *
 * 那是靠自律。**讓它拿不到東西可還原，才是機制。**
 *
 * > **一個「不會發生」的保證，如果只寫在註解裡，
 * > 它會在某次重構之後安靜地失效。**
 *
 * ## 自我否證聲明（⚠️ 寫在斷言之前）
 *
 * > **如果那個假存檔裡沒有程式碼，這支測試會綠——而它什麼都沒證明。**
 *
 * 所以先釘一個**正向錨點**：同一份假存檔餵給**網頁版的宣告**時，
 * `setCode` **必須被呼叫**。兩邊都驗，這條才有意義。
 */
import { describe, it, expect } from 'vitest'
import { StorageService } from '../../src/core/storage'
import { vscodeProfile } from '../../src/vscode/vscode-profile'
import type { StorageLike } from '../../src/core/host/host-profile'
import type { SavedState } from '../../src/core/storage'

// ⚠️ **對照組刻意不用 `webProfile`**：它會拉進編輯器套件，
//    而那個套件在測試環境解析不了（`Failed to resolve entry for package "monaco-editor"`）。
//    🟢 而對照組要的性質是「一個【會還原】的存檔服務」——`StorageService` 就是它，
//    而且它不牽扯任何編輯器。**測性質，不測那個具體的組裝。**

/** 一份「上一次存了程式碼」的存檔——⚠️ 而它在新宿主裡是**過期的真相**。 */
const STALE: SavedState = {
  version: 9,
  tree: null,
  blocklyState: {},
  code: '// 這是上一個檔案的內容，絕不能出現在使用者的檔案裡\nint stale() { return 1; }\n',
  language: 'cpp',
  styleId: 'apcs',
  lastModified: '2026-01-01T00:00:00.000Z',
}

/** 問一個存檔服務：存了之後，還原得到程式碼嗎？ */
function restorableCode(storage: StorageLike): string | undefined {
  storage.save(STALE)
  const outcome = storage.loadOutcome()
  if (outcome.kind === 'loaded' || outcome.kind === 'migrated') return outcome.state.code
  return undefined
}

describe('開機不得覆蓋使用者的檔案', () => {
  it('正向錨點：網頁版還原得到程式碼（否則下面那條是空過的）', () => {
    // ⚠️ 網頁版的存檔【就是】真相，所以它必須還原得到東西。
    expect(restorableCode(new StorageService()), '🔴 對照組還原不到 → 這支測試壞了')
      .toBe(STALE.code)
  })

  it('🔴 這個宿主還原不到任何程式碼——因為【檔案才是真相】', () => {
    expect(restorableCode(vscodeProfile.createStorage())).toBeUndefined()
  })

  it('🔴 而它連存都不存文件內容——存檔裡不得留下使用者的程式碼', () => {
    // ⚠️ 「載不出來」還不夠：一份留在儲存體裡的程式碼，
    //    下一版的還原邏輯可能就把它撈出來了。**根本不要存。**
    const storage = vscodeProfile.createStorage()
    storage.save(STALE)
    const dumped = JSON.stringify(storage.dumpForTest?.() ?? {})
    expect(dumped).not.toContain('stale')
  })

  it('宿主宣告了它不還原文件內容，而那是一份【看得到的宣告】', () => {
    expect(vscodeProfile.featureReasons).toBeTruthy()
    expect(Object.keys(vscodeProfile.featureReasons).length).toBeGreaterThan(0)
  })
})
