/**
 * **第一百一十九條護欄：「積木改不動程式碼」這件事要說出來。**
 *
 * ## 🔴 學生回報（2026-09-10）
 *
 * > 「我執行一次之後改右邊，左邊不會改，下方的答案也不會改。
 * >  我不知道是我的問題還是他的。反正我還要自己改左邊。」
 *
 * 積木載入失敗之後，`isStateStale` 會擋掉「積木→程式碼」——**那是對的**
 * （殘的工作區寫回去，等於把使用者的檔案刪掉一半）。
 *
 * 錯的是它**不說**：
 *
 * ```
 * 狀態列        ⇄ 同步中          🔴 它在說謊
 * 改一顆積木     什麼都沒發生       🔴 連一句話都沒有
 * 怎麼恢復       只有改程式碼有用    🔴 而沒有人告訴他
 * ```
 *
 * ⚠️ 而那個旗標**只在下一次成功重畫時才清**——被擋住就不會有下一次重畫，
 * 於是它卡到使用者自己去改程式碼為止。
 *
 * > **一個「我暫時不聽你的」的狀態，如果沒有一直說出來，
 * > 使用者會以為是自己不會用。**
 *
 * ## 本護欄不檢測什麼
 *
 * - 🪦 **不驗「以此為準：積木」救得回來**——那條路試過了，
 *   它寫回去的是**舊的樹**，使用者剛改的那一格會被靜靜退掉。
 *   > **一條會把使用者剛做的事丟掉的救援路徑，是第二次損失。**
 * - ⚠️ **`not-rendered` 不得出聲**——那是開機的正常過渡
 *   （2026-08-24 使用者已經回報過一次「每次重新整理都跳紅字」）。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT } from '../../helpers/guardrail'

const appSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/ui/app.ts'), 'utf8')
const shellSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/ui/app-shell.ts'), 'utf8')
const panelSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/ui/panels/blockly-panel.ts'), 'utf8')

describe('第一百一十九條護欄：積木改不動程式碼要說出來', () => {
  it('★ 入口條件——三個檔都讀到了', () => {
    expect(appSrc.length + shellSrc.length + panelSrc.length).toBeGreaterThan(10000)
  })

  it('🔴 狀態列有第四態，而它不是「同步中」', () => {
    expect(shellSrc, '🔴 狀態列少了「積木改不動程式碼」那一態')
      .toContain('SYNC_STATE_BLOCKS_STUCK')
    expect(shellSrc, "🔴 型別上沒有 'blocks-stuck' → 那一態進不了狀態列")
      .toMatch(/'blocks-stuck'/)
  })

  it('🔴 那一態的字兩個語系都有', () => {
    for (const loc of ['zh-TW', 'en']) {
      const msgs = JSON.parse(
        fs.readFileSync(path.join(REPO_ROOT, `src/i18n/${loc}/blocks.json`), 'utf8'),
      ) as Record<string, string>
      expect(msgs.SYNC_STATE_BLOCKS_STUCK, `🔴 ${loc} 少了那一句`).toBeTruthy()
    }
  })

  /**
   * 🔴 **`load-failed` 才說，`not-rendered` 不說。**
   *
   * 兩種殘都要擋寫回，而只有一種該對使用者喊。
   */
  it('🔴 只有 load-failed 那一種出聲', () => {
    expect(appSrc, '🔴 自動同步那條路上的 early return 沒有出聲')
      .toMatch(/staleReason === 'load-failed'\)\s*this\.warnBlocksStuck\(\)/)
    expect(appSrc, '🔴 沒有那一支「說一句」的函式').toContain('private warnBlocksStuck()')
    expect(appSrc, '🔴 狀態列那一支沒有把 load-failed 疊上去')
      .toMatch(/staleReason === 'load-failed'[\s\S]{0,120}'blocks-stuck'/)
  })

  /** ⚠️ 節流——一次拖曳會產生好幾則事件，每一則都喊就是噪音。 */
  it('★ 那句話有節流', () => {
    expect(appSrc).toContain('lastStuckWarnAt')
  })

  /**
   * 🔴 **恢復之後狀態列要跟著回去。**
   *
   * 旗標在 `setState` 成功的下一行就清掉了，而狀態列不知道
   * ——於是那個 ⛔ 會一直掛著。
   *
   * > **一個恢復了卻還在喊警報的畫面，比不喊還糟：
   * > 它教使用者不要相信那個警報。**
   */
  it('🔴 從殘恢復過來時會通知外面', () => {
    expect(panelSrc, '🔴 面板沒有「殘→好」的通知').toContain('onStaleChanged')
    expect(appSrc, '🔴 組裝點沒有接那條通知')
      .toMatch(/onStaleChanged\(\(\) => this\.refreshStatusBar\(\)\)/)
    // ⚠️ **要在 setState 之前記**——旗標在成功那一行就被清了
    const i = panelSrc.indexOf('const wasLoadFailed')
    const j = panelSrc.indexOf('this.setState(event.blockState')
    expect(i, '🔴 沒有先記下「剛才是不是 load-failed」').toBeGreaterThan(0)
    // 🔴 **不得把開機的正常過渡也算成一次恢復**——那會每次開機放一次假警報解除
    expect(panelSrc, '🔴 用了 staleReason !== null → 每次開機都會送通知')
      .not.toContain('const wasStale = this.staleReason !== null')
    expect(i, '🔴 記得太晚——旗標已經被清掉，那個通知永遠不會送').toBeLessThan(j)
  })

  // ─── 注入（第四十九條）───

  it('★ 注入：把出聲拿掉 → 這條護欄會紅', () => {
    const injured = appSrc.replace(/if \(this\.blocklyPanel\.staleReason === 'load-failed'\) this\.warnBlocksStuck\(\)\n/, '')
    expect(/staleReason === 'load-failed'\)\s*this\.warnBlocksStuck\(\)/.test(injured)).toBe(false)
  })

  it('★ 反向：`not-rendered` 不得被拿去喊', () => {
    expect(appSrc, "🔴 開機的正常過渡也在喊——2026-08-24 那個錯誤又回來了")
      .not.toMatch(/staleReason === 'not-rendered'\)\s*this\.warnBlocksStuck\(\)/)
  })
})
