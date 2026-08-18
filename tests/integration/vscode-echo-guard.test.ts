/**
 * 回音守衛的自證測 —— **而它要證的是「不必用時間」**。
 *
 * ## 它取代什麼
 *
 * `experience.md:2866`「同一個防迴圈的問題，在同步宿主用布林旗標就夠，
 * **在非同步宿主要加時間**」——而那一則自己標了：
 *
 * > ⚠️ 用時間的那個版本，**那個常數是猜的**（50ms 沒有人驗過夠不夠）。
 *
 * 🟢 而文件版本號是**單調遞增**的（宿主保證），所以回音認得出來：
 *
 * ```
 * 送出編輯 → 記下產生的版本
 * 事件進來 → 版本是我們產生的嗎？是 → 回音，忽略
 * ```
 *
 * > **非同步宿主要的不是「時間」，是【一個身分】。
 * > 加時間是在猜「回音應該多久之內回來」——而那個猜測沒有上界。**
 *
 * ## ⚠️ 自我否證
 *
 * > **本檔【不得】出現任何計時**（`setTimeout`／`Date`／`performance`）。
 * > 出現了就代表這個守衛沒有做到它宣稱的事。
 */
import { describe, it, expect } from 'vitest'
import { EchoGuard } from '../../src/vscode/sync/echo-guard'

describe('EchoGuard —— 用身分認回音，不用時間', () => {
  it('正向錨點：記過的版本回來 → 判為回音', () => {
    const g = new EchoGuard()
    g.remember(7)
    expect(g.isEcho(7)).toBe(true)
  })

  it('沒記過的版本 → 判為外來變更', () => {
    const g = new EchoGuard()
    g.remember(7)
    expect(g.isEcho(8)).toBe(false)
  })

  it('🔴 連續兩次編輯——先回來的那個仍判為回音', () => {
    // ⚠️ **這一條是「集合 vs 單一變數」的分水嶺。**
    // 只記「上一個」的話，`remember(9)` 會蓋掉 8，
    // 而 8 的事件回來時就被誤判成外來變更 → 無窮迴圈。
    const g = new EchoGuard()
    g.remember(8)
    g.remember(9)
    expect(g.isEcho(8)).toBe(true)
    expect(g.isEcho(9)).toBe(true)
  })

  it('回音認過就消掉——同一個版本不會被認第二次', () => {
    const g = new EchoGuard()
    g.remember(5)
    expect(g.isEcho(5)).toBe(true)
    expect(g.isEcho(5)).toBe(false)
  })

  it('🔴 上界用【數量】——超過容量時丟掉最舊的，而不是等它過期', () => {
    const g = new EchoGuard(2)
    g.remember(1)
    g.remember(2)
    g.remember(3) // 1 被擠掉
    expect(g.isEcho(1)).toBe(false)
    expect(g.isEcho(2)).toBe(true)
    expect(g.isEcho(3)).toBe(true)
  })

  it('切換文件時清空——上一份文件的版本號與這一份無關', () => {
    const g = new EchoGuard()
    g.remember(42)
    g.reset()
    expect(g.isEcho(42)).toBe(false)
  })

  it('pending 數看得出來——🔴 交棒時讀數要顯示它', () => {
    const g = new EchoGuard()
    expect(g.pendingCount).toBe(0)
    g.remember(1)
    g.remember(2)
    expect(g.pendingCount).toBe(2)
    g.isEcho(1)
    expect(g.pendingCount).toBe(1)
  })

  // ─────────────────────────────────────────────────────────────
  // 🔴 時序：**事件比版本號早到**
  //
  // 2026-08-18 使用者實測「改了 mutation 之後直接跳回純宣告」，
  // 而根因在這裡：`onDidChangeTextDocument` 在 `editor.edit()` 的 Promise
  // 解析【之前】就觸發，所以「事後 `remember(doc.version)`」認不出圈內那一則
  // → 宿主把自己造成的變更當成外來的 → 重送文件 → code→blocks → 積木被回捲。
  //
  // > **「記下我做了什麼」如果發生在「做」之後，
  // > 那麼在「做」的當下問「這是我做的嗎」，答案永遠是否。**
  // ─────────────────────────────────────────────────────────────

  it('🔴 正向錨點：沒有圈起來時，編輯進行中的事件【認不出來】（這就是那個 bug）', () => {
    const g = new EchoGuard()
    // 模擬：edit() 內部就發了事件，而 remember 還沒被呼叫
    expect(g.isEcho(7), '⚠️ 這條若變成 true，下面那條就空過了').toBe(false)
  })

  it('圈起來之後，編輯進行中收到的版本算我們的', () => {
    const g = new EchoGuard()
    g.beginApply()
    expect(g.isEcho(7)).toBe(true)
    g.endApply()
  })

  it('⚠️ 圈外晚到的同一個版本也要認得——事件可能發兩次', () => {
    const g = new EchoGuard()
    g.beginApply()
    g.isEcho(7)      // 圈內：認出並記下
    g.endApply()
    expect(g.isEcho(7), '🔴 晚到的那一則被當成外來變更 → 重送文件 → 回捲').toBe(true)
  })

  it('🔴 圈結束之後，使用者自己打的字【不得】被當成回音吞掉', () => {
    const g = new EchoGuard()
    g.beginApply()
    g.isEcho(7)
    g.endApply()
    expect(g.isEcho(8)).toBe(false)
  })

  it('reset 要把圈也解開——否則一次切換文件會讓守衛永遠開著', () => {
    const g = new EchoGuard()
    g.beginApply()
    g.reset()
    expect(g.isEcho(1)).toBe(false)
  })

  it('⚠️ 自我否證：這個模組的原始碼裡零個計時', async () => {
    // 一個「用身分不用時間」的宣稱，要有一條機械檢查頂著
    // ——否則它只是註解。
    const fs = await import('node:fs')
    const src = fs.readFileSync('src/vscode/sync/echo-guard.ts', 'utf8')
    for (const banned of ['setTimeout', 'setInterval', 'Date.now', 'performance.now']) {
      expect(src, `🔴 回音守衛裡不得出現 ${banned}`).not.toContain(banned)
    }
  })
})
