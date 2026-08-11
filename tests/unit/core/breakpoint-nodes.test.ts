/**
 * **斷點：行號 → 語義節點的翻譯。**
 *
 * ## 這支測試存在的理由
 *
 * 斷點判斷原本長這樣，住在 `execution-controller` 裡：
 *
 * ```ts
 * const breakpoints = monacoPanel.getBreakpoints()          // 行號
 * const hit = breakpoints.some(bp => bp >= mapping.startLine + 1 && bp <= mapping.endLine + 1)
 * ```
 *
 * **執行器跟程式碼視圖要行號，然後自己做區間比對**——於是執行器知道有「行」，
 * 而那是文字投影才有的概念。反轉之後翻譯發生在懂那個語彙的一端。
 *
 * > **翻譯要發生在懂那個語彙的一端。**
 *
 * ⚠️ 而反轉之後，**這個函式是整條線上唯一會算錯的地方**（其餘都是傳遞），
 * 所以它被抽成 export 的純函式而不是私有方法——
 * 一條「面板推、執行器收」的線，用瀏覽器點擊去驗**很貴而且容易點不中**
 * （實測：同一個座標點兩次會 toggle 回去，而畫面上看不出差別）。
 */
import { describe, it, expect } from 'vitest'
import { 斷點對應的節點 } from '../../../src/core/projection/code-mapping'
import type { CodeMapping } from '../../../src/core/projection/code-generator'

/** ⚠️ `startLine`／`endLine` 是 **0-based**，而使用者點的斷點行是 **1-based**。 */
const 對映: CodeMapping[] = [
  { nodeId: 'main', startLine: 3, endLine: 8 }, // 第 4–9 行
  { nodeId: 'decl', startLine: 4, endLine: 4 }, // 第 5 行
  { nodeId: 'loop', startLine: 5, endLine: 7 }, // 第 6–8 行
  { nodeId: 'body', startLine: 6, endLine: 6 }, // 第 7 行
]

describe('斷點對應的節點', () => {
  it('沒有斷點就沒有節點', () => {
    expect(斷點對應的節點(對映, [])).toEqual([])
  })

  it('★ 0-based 對映 vs 1-based 行號——差一就全錯', () => {
    // 第 5 行 → decl（startLine 4）。若少了 +1，會變成命中 loop。
    expect(斷點對應的節點(對映, [5])).toContain('decl')
    expect(斷點對應的節點(對映, [5])).not.toContain('body')
  })

  it('★ 是區間包含，不是相等', () => {
    // 第 7 行落在 loop 的 [6,8] 之內，即使 loop 不是從第 7 行開始
    expect(斷點對應的節點(對映, [7])).toContain('loop')
  })

  it('★ 祖先也會命中——那不是 bug，是原本就有的語義', () => {
    // `main` 涵蓋第 4–9 行，所以任何一個裡面的斷點都會讓它命中。
    // 執行走到 `main` 節點時本來就會停，改成推送之後行為不變。
    expect(斷點對應的節點(對映, [7])).toContain('main')
  })

  it('★ 去重——同一個節點不得出現兩次', () => {
    const r = 斷點對應的節點(對映, [6, 7, 8])
    expect(r.filter((x) => x === 'loop')).toHaveLength(1)
  })

  it('★ 反向：區間外的斷點不得命中', () => {
    // 這一條不可省。沒有它，一個「全部回傳」的實作也能通過上面每一條。
    expect(斷點對應的節點(對映, [1])).toEqual([])
    expect(斷點對應的節點(對映, [99])).toEqual([])
    expect(斷點對應的節點(對映, [5])).not.toContain('loop')
  })

  it('★ 沒有對映時不得亂猜', () => {
    expect(斷點對應的節點([], [5, 6, 7])).toEqual([])
  })
})
