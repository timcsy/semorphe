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
