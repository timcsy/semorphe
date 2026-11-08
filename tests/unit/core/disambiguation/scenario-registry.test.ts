import { describe, it, expect, beforeEach } from 'vitest'
import { registerScenarioKind, scenariosFor, resetScenarioKindsForTest, SCENARIO_LIMIT } from '../../../../src/core/disambiguation/scenario-registry'
import type { SemanticNode } from '../../../../src/core/types'

const tree = { id: 'r', componentId: 'x:program', properties: {}, slots: {} } as SemanticNode

describe('情境登記處（spec 218）', () => {
  beforeEach(() => resetScenarioKindsForTest())
  it('同一個種類登記兩次 → throw', () => {
    registerScenarioKind('k1', () => [])
    expect(() => registerScenarioKind('k1', () => [])).toThrow(/k1/)
  })
  it('每個種類各產生、合併；每種最多 SCENARIO_LIMIT 筆；同一棵樹兩次結果相同', () => {
    registerScenarioKind('many', () => Array.from({ length: 50 }, (_, i) => ({ kind: 'many', payload: i, label: `#${i}` })))
    registerScenarioKind('few', () => [{ kind: 'few', payload: 0, label: 'one' }])
    const a = scenariosFor(tree)
    expect(a.filter((s) => s.kind === 'many')).toHaveLength(SCENARIO_LIMIT)
    expect(a.filter((s) => s.kind === 'few')).toHaveLength(1)
    expect(scenariosFor(tree)).toEqual(a)
  })
  it('產生器回了別的種類的情境 → throw（種類由登記的那一個說了算）', () => {
    registerScenarioKind('mine', () => [{ kind: 'other', payload: 0, label: 'x' }])
    expect(() => scenariosFor(tree)).toThrow(/mine/)
  })
})
