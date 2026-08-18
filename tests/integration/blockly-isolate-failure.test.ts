/**
 * 🔴 **失敗時要指得出是哪一顆積木。**
 *
 * ## 病歷（2026-08-18，Arduino IDE）
 *
 * `Blockly.serialization.workspaces.load` 拋 `TypeError: … reading 'indexOf'`，
 * ⚠️ **而那句話對「是哪一顆積木害的」一個字都沒說**。
 * 它只在 Theia 出現，Chromium 用相同的檔案內容重現不到
 * ——於是連續猜了三個假設，三個都錯。
 *
 * > **推理的替代品不是更好的推理，是把失敗的輸入縮到最小。**
 *
 * ## ⚠️ 這支測試的邊界
 *
 * 🟢 守得住：隔離器**存在、被接上、而且回傳的三種答案分得出來**。
 * 🔴 守不住：它在 Theia 裡指得準不準——那要在那個環境才驗得到。
 *    ⚠️ 而那正是它存在的理由，所以這裡不假裝測到了。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const SRC = readFileSync('src/ui/panels/blockly-panel.ts', 'utf8')
const NO_COMMENTS = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

describe('載入失敗要指得出是哪一顆積木', () => {
  it('🔴 正向錨點：隔離器存在（不然下面幾條在測空氣）', () => {
    expect(NO_COMMENTS).toContain('isolateFailingBlock')
  })

  it('它被接上了——只存在而沒有人呼叫，等於不存在', () => {
    // 一次宣告 ＋ 一次呼叫
    const hits = NO_COMMENTS.match(/isolateFailingBlock/g) ?? []
    expect(hits.length, '🔴 只出現一次 → 宣告了而沒有人呼叫').toBeGreaterThanOrEqual(2)
  })

  it('🔴 三種答案要分得出來——「都載得起來」不等於「隔離失敗」', () => {
    // ⚠️ 兩者都回 null 的話，一個「問題在組合」會被讀成「隔離器壞了」。
    expect(SRC).toContain('逐顆都載得起來')
    expect(SRC).toContain('隔離失敗')
    expect(SRC).toContain('狀態裡沒有積木')
  })

  it('用的是【沒有畫布】的工作區——序列化不需要 SVG，而失敗當下畫布可能已經壞了', () => {
    expect(NO_COMMENTS).toContain('new Blockly.Workspace()')
  })

  it('出事的積木要進到訊息裡（使用者看得到的那一則）', () => {
    expect(NO_COMMENTS).toContain('出事的積木')
  })
})
