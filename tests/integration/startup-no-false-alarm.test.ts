/**
 * **開機不准喊「系統錯誤」。**
 *
 * 使用者 2026-08-24（附截圖）：
 *
 * > 「我每次重新整理下面都會跳出一條這個，我覺得**這會讓使用者有誤會，
 * > 以為剛開啟的時候系統錯誤**。」
 *
 * 那條紅字是「積木沒有完整載入，暫停同步到程式碼——請按『程式碼→積木』重載」。
 * 而積木完整得很（截圖裡整份都在），它只是**還沒被匯流排畫過**。
 *
 * ## 兩種「殘」被混成了同一句話
 *
 * ```
 * stateLoadFailed   真的載壞了       → 要出聲
 * !hasRendered      還沒畫過（開機） → 【不要】出聲：那是正常的過渡狀態
 * ```
 *
 * 擋住寫回這件事**兩種都要擋**（那是安全網，不可退讓）；分開的是**說什麼**。
 *
 * > **一個把「還沒發生」講成「失敗了」的訊息，
 * > 每一次正常開機都在教使用者不要相信錯誤訊息。**
 *
 * ⚠️ 這是一支**靜態**檢查：真正要驗的性質（重新整理之後畫面上沒有紅字）
 * 需要整個瀏覽器，而那一步由人工驗收做（`verify-in-browser`）。
 * 🔴 靜態守得住「有沒有分開」，守不住「分得對不對」——這一點要說清楚。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')
const read = (p: string): string => readFileSync(path.join(ROOT, p), 'utf8')
/** ⚠️ **先把註解拿掉再掃**——這個檔自己就在引用那串紅字（同 `blockly-stale-state`）。 */
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('開機時不得誤報「積木沒有完整載入」', () => {
  it('★ 錨點：那條訊息與那個判定都還在（否則下面的斷言是空過的）', () => {
    const app = strip(read('src/ui/app.ts'))
    expect(app, '訊息被改名了 → 這支測試要跟著改，而不是靜靜地不再守任何東西')
      .toContain('積木沒有完整載入')
    expect(strip(read('src/ui/panels/blockly-panel.ts')), '判定改名了')
      .toContain('staleReason')
  })

  it('🔴 那條紅字只在【真的載壞了】時出現', () => {
    const app = strip(read('src/ui/app.ts'))
    // 訊息前面必須有一個「是不是 load-failed」的判斷
    const at = app.indexOf('積木沒有完整載入')
    const before = app.slice(Math.max(0, at - 400), at)
    expect(before, "紅字沒有被 `staleReason === 'load-failed'` 圈住 → 開機就會彈")
      .toContain("'load-failed'")
  })

  it('🔴 而【擋住寫回】兩種殘都要擋——分開的是說什麼，不是擋不擋', () => {
    const panel = strip(read('src/ui/panels/blockly-panel.ts'))
    expect(panel, '`isStateStale` 必須仍然兩種都為真（安全網不可退讓）')
      .toMatch(/isStateStale[\s\S]{0,200}staleReason !== null/)
    expect(panel).toMatch(/staleReason[\s\S]{0,400}stateLoadFailed[\s\S]{0,200}hasRendered/)
  })

  it('🔴 另一條寫回的路（`resyncAfterTopicChange`）也要有安全網', () => {
    const app = strip(read('src/ui/app.ts'))
    const at = app.indexOf('private resyncAfterTopicChange')
    const body = app.slice(at, at + 400)
    expect(body, '一張只蓋住一條路的安全網，與沒有安全網的差別只在缺陷走哪一條路')
      .toContain("'load-failed'")
  })
})
