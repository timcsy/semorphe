/**
 * 診斷投影到程式碼座標 —— **兩個程式碼視圖共用的那一段**。
 *
 * ## 為什麼值得一支測試
 *
 * 2026-08-25「診斷 → IDE 的 Problems」把這段從 `monaco-panel.ts` 抽進核心，
 * 因為擴充裡那個**沒有畫布**的程式碼視圖需要同一份。
 *
 * 🔴 而它最重要的性質是**負向的**：
 *
 * > **對映不到的診斷要【丟掉】，不是退回第 1 行
 * > ——一個指錯地方的波浪比沒有波浪更糟：
 * > 它會讓學生去看一段沒有問題的程式碼。**
 *
 * ⚠️ 這支測試**不驗訊息的措辭**（那要載 i18n 表），只驗座標與取捨。
 */
import { describe, it, expect } from 'vitest'
import { mappingFor, projectDiagnostics } from '../../../src/core/projection/diagnostic-projection'
import type { SemanticNode } from '../../../src/core/types'
import type { CodeMapping } from '../../../src/core/projection/code-generator'
import type { Diagnostic } from '../../../src/core/diagnostics'

const tree = {
  id: 'zz-root', componentId: 'zz:root', children: { body: [
    { id: 'zz-stmt', componentId: 'zz:stmt', children: { expr: [
      { id: 'zz-expr', componentId: 'zz:expr', children: {} },
    ] } },
  ] },
} as unknown as SemanticNode

const mappings: CodeMapping[] = [
  { nodeId: 'zz-stmt', startLine: 4, endLine: 6 } as CodeMapping,
]

const diag = (nodeId: string, at?: { line: number; column: number }): Diagnostic =>
  ({ nodeId, severity: 'warning', rule: 'ZZ_FAKE', params: {}, at }) as Diagnostic

describe('診斷 → 程式碼座標', () => {
  it('入口條件：合成的樹真的有那三顆（否則下面整組空過）', () => {
    expect(mappingFor(mappings, tree, 'zz-stmt')?.startLine).toBe(4)
  })

  it('表達式節點自己沒有對映——往上找最近有對映的祖先', () => {
    expect(mappingFor(mappings, tree, 'zz-expr')?.startLine).toBe(4)
  })

  it('🔴 對映不到就回 `undefined`——**不是第 1 行**', () => {
    expect(mappingFor(mappings, tree, 'zz-not-there')).toBeUndefined()
    expect(mappingFor(mappings, null, 'zz-expr')).toBeUndefined()
  })

  it('🔴 對映不到的診斷**直接丟掉**，不佔一個位置', () => {
    const out = projectDiagnostics([diag('zz-not-there')], mappings, tree)
    expect(out, '🔴 指錯地方的波浪比沒有波浪更糟').toEqual([])
  })

  it('沒有 `at` 的畫整行——`endColumn: null` ＝「到行尾，而行尾由視圖決定」', () => {
    const [d] = projectDiagnostics([diag('zz-stmt')], mappings, tree)
    expect(d.startLine).toBe(4)
    expect(d.endLine).toBe(6)
    expect(d.startColumn).toBe(0)
    expect(d.endColumn, '🔴 這裡不猜行尾——只有拿得到文件的那一端知道').toBeNull()
  })

  it('🔴 有 `at` 的縮到那個縫上，而**寬度至少一欄**', () => {
    // ⚠️ 一個缺掉的 token 佔零個字元；`start === end` 的標記畫不出來
    //    ——那會讓「修好了」與「畫不出來」長得一樣。
    const [d] = projectDiagnostics([diag('zz-stmt', { line: 5, column: 12 })], mappings, tree)
    expect([d.startLine, d.startColumn, d.endLine, d.endColumn]).toEqual([5, 12, 5, 13])
  })

  it('嚴重度原樣帶過去——**降級是誠實的反面**', () => {
    const err = { ...diag('zz-stmt'), severity: 'error' as const }
    expect(projectDiagnostics([err], mappings, tree)[0].severity).toBe('error')
  })
})
