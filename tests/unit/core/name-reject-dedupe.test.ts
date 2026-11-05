import { describe, it, expect } from 'vitest'
import { dropRejectsCoveredByNameChecks, type Diagnostic } from '../../../src/core/diagnostics'

const d = (nodeId: string, source: Diagnostic['source'], rule: string): Diagnostic => ({ nodeId, source, rule, severity: 'error', params: {} })

describe('名字不合法與 Cella 的 reject 去重（spec 216）', () => {
  it('🔴 同一顆：只留形態那一則', () => {
    expect(dropRejectsCoveredByNameChecks([d('n1', 'component', 'BAD_NAME_STARTS_WITH_DIGIT'), d('n1', 'cella', 'CELLA_REJECT')]).map((x) => x.rule)).toEqual(['BAD_NAME_STARTS_WITH_DIGIT'])
  })
  it('不同顆的 reject、或同一顆而不是 reject 的判決：照留', () => {
    const all = [d('n1', 'component', 'BAD_NAME_RESERVED'), d('n2', 'cella', 'CELLA_REJECT'), d('n1', 'cella', 'CELLA_UB_UNINIT')]
    expect(dropRejectsCoveredByNameChecks(all)).toEqual(all)
  })
})

describe('細分過的 reject 也算（錯誤訊息第四步量到）', () => {
  it('★ 名字不合法的那一顆，Cella 說的是細分的種類（例如重複宣告）——也只留形態那一則', () => {
    const d = (nodeId: string, source: Diagnostic['source'], rule: string): Diagnostic => ({ nodeId, source, rule, severity: 'error', params: {} })
    for (const rule of ['CELLA_REDECLARED', 'CELLA_NOT_ASSIGNABLE', 'CELLA_OPERAND_TYPES']) {
      expect(dropRejectsCoveredByNameChecks([d('n1', 'component', 'BAD_NAME_STARTS_WITH_DIGIT'), d('n1', 'cella', rule)]).map((x) => x.rule)).toEqual(['BAD_NAME_STARTS_WITH_DIGIT'])
    }
  })
})
