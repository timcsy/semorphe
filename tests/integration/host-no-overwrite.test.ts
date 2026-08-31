/**
 * @vitest-environment happy-dom
 *
 * ⚠️ **預設環境是 `node`**（2026-08-21，見 `vitest.config.ts` 的說明）——
 * 這個檔碰得到 DOM（`document`／`localStorage`／面板），所以顯式加回來。
 */
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
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

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

/**
 * 🔴 **第二種形狀：不是「用存檔蓋」，是「用【產生的骨架】蓋」。**
 *
 * ## 它從哪來
 *
 * 使用者 2026-08-31：「我用 Arduino IDE 把 semorphe 開起來，
 * 原本的 `setup` 和 `loop` 會被 C++ 預設骨架覆蓋」。
 *
 * 上面那一族守的是「**存檔**裡的程式碼不得蓋掉檔案」，而這一次蓋掉檔案的
 * **不是存檔**——存檔是空的。是同日稍早為了修「第一次打開拉積木沒反應」
 * 而加的那一行開機同步：它從**空工作區**產生 `using namespace std; int main(){}`
 * 並寫進 `codeView`，而在擴充裡那是「算出範圍 → 交給宿主寫回」。
 *
 * > **一個「補一份預設內容」的動作，在內容還在路上的時候，
 * > 補的是「還沒到」那個狀態的預設值。**
 *
 * ⚠️ 而宿主的 `document` 訊息是一次 postMessage 往返，**必然比開機晚到**
 * ——所以這不是時序運氣不好，是**結構上一定會發生**。
 *
 * ## 判準問視圖的能力，不問宿主的名字
 *
 * `if (host === 'vscode')` 會讓宣告退化成標籤（第六十三條護欄的判準）。
 * 所以埠上多一格 `documentBacked`：**這個視圖的內容來自外部文件嗎**。
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果兩個宣告【都】是 `true`／都是 `undefined`，這支測試什麼都沒證明。**
 *
 * 所以兩邊都釘：擴充那側必須是 `true`，而網頁版那側**必須不是**
 * ——網頁版沒有檔案，開機產生骨架**是對的**（它修掉了「第一次打開畫面是空的」）。
 */
describe('開機產生的骨架不得覆蓋外部文件', () => {
  it('🔴 擴充的程式碼視圖宣告了「我的內容來自外部文件」', async () => {
    const mod = await import('../../src/vscode/webview/vscode-code-view')
    const cls = mod.VscodeCodeView as unknown as { prototype: { documentBacked?: boolean } }
    // ⚠️ 讀原型而不是建一個實例——建構子要真的 `acquireVsCodeApi()`
    expect(
      cls.prototype.documentBacked ??
        // 宣告成實例欄位時原型上沒有，改查原始碼的宣告（同樣是「它宣告了嗎」）
        /readonly documentBacked = true/.test(
          (await import('node:fs')).readFileSync(
            (await import('node:path')).join(process.cwd(), 'src/vscode/webview/vscode-code-view.ts'),
            'utf8',
          ),
        ),
      '🔴 擴充的程式碼視圖沒有宣告 `documentBacked` → 開機時我們會先寫一份骨架蓋掉使用者的檔案',
    ).toBe(true)
  })

  it('★ 反向錨點：組裝點真的問了那一格，而不是寫死宿主判斷', () => {
    // 🔴 **只看程式碼，不看散文**——這條規則管的是「組裝點怎麼判斷」，
    //    而註解裡為了解釋「不要這樣寫」而引用那個寫法是**正當的**。
    //
    // ⚠️ 而這一課是實測來的：第一版沒有剝註解，於是它報出的那一筆
    //    **正是下面這段解釋文字自己**。
    //
    // > **一段解釋某個寫法為什麼危險的文字，本身就含有那個寫法
    // > ——而一個只 grep 字面的檢查分不出「在用它」與「在講它」。**
    const raw = readFileSync(join(process.cwd(), 'src/ui/app.ts'), 'utf8')
    const src = raw
      .replace(/\/\*[\s\S]*?\*\//g, '')   // 區塊註解
      .replace(/\/\/[^\n]*/g, '')          // 行註解
    // 開機那條早退必須被 `documentBacked` 守著
    expect(
      /documentBacked\)?\s*\)\s*this\.resyncAfterTopicChange\(\)/.test(src) ||
        /if \(!this\.codeView\?\.documentBacked\) this\.resyncAfterTopicChange\(\)/.test(src),
      '🔴 開機同步那一行沒有被 `documentBacked` 守著',
    ).toBe(true)
    // 🔴 而**不准**改回問宿主的名字
    expect(
      /host\s*===\s*['"]vscode['"]/.test(src),
      '🔴 用宿主名字判斷 → 宣告退化成標籤（第六十三條護欄的判準）',
    ).toBe(false)
  })
})
