/**
 * **條號收進詳細資訊**（錯誤訊息第五步）——`C++17 [expr.add]p4` 對學生是行話：第一眼的那一句不帶它，
 * 它跟著診斷走、由宿主放在標記的 `code`（Monaco 的 hover、VSCode 的 Problems）。
 */
import { describe, it, expect } from 'vitest'
import zhTW from '../../../src/i18n/zh-TW/blocks.json'
import en from '../../../src/i18n/en/blocks.json'
import { codeDiagnosticDetail, projectDiagnostics } from '../../../src/core/projection/diagnostic-projection'
import { createNode } from '../../../src/core/semantic-tree'
import type { Diagnostic } from '../../../src/core/diagnostics'

describe('條號收進詳細資訊', () => {
  it('🔴 硬性零：任何一則診斷文案都不帶 {clause}', () => {
    const bad = [zhTW, en].flatMap((t) => Object.entries(t as Record<string, string>).filter(([k, v]) => k.startsWith('DIAG_') && v.includes('{clause}')).map(([k]) => k))
    expect(bad).toEqual([])
  })

  it('★ 有條號 → 它是詳細資訊；沒有 → undefined', () => {
    const d = (clause?: string): Diagnostic => ({ nodeId: 'n', source: 'cella', rule: 'CELLA_UB_DIV_ZERO', severity: 'error', params: clause === undefined ? {} : { clause } })
    expect(codeDiagnosticDetail(d('C++17 [expr.mul]p4'))).toBe('C++17 [expr.mul]p4')
    expect(codeDiagnosticDetail(d(''))).toBeUndefined()
    expect(codeDiagnosticDetail(d())).toBeUndefined()
  })

  it('★ 投影到程式碼座標時，詳細資訊跟著走（兩個宿主都從這裡拿）', () => {
    const n = createNode('cpp:var_ref', { name: 'x' })
    const tree = createNode('cpp:program', {}, { body: [n] })
    const out = projectDiagnostics(
      [{ nodeId: n.id, source: 'cella', rule: 'CELLA_UB_DIV_ZERO', severity: 'error', params: { clause: 'C++17 [expr.mul]p4' } }],
      [{ nodeId: n.id, startLine: 0, endLine: 0 }] as never, tree)
    expect(out[0]?.detail).toBe('C++17 [expr.mul]p4')
    expect(out[0]?.message).not.toContain('[expr')
  })
})
