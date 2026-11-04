import { describe, it, expect } from 'vitest'
import { carryTypes } from '../../../src/core/projection/carry-types'
import type { SemanticNode } from '../../../src/core/types'

const n = (id: string, componentId: string, properties: Record<string, unknown> = {}, slots: Record<string, SemanticNode[]> = {}): SemanticNode =>
  ({ id, componentId, properties, slots } as SemanticNode)

describe('carryTypes（spec 215）', () => {
  const tree = (p: string, t: string) => n(`${p}0`, 'x:program', {}, { body: [n(`${p}1`, 'x:decl', { type: t, name: 'x' }), n(`${p}2`, 'x:print', {}, { values: [n(`${p}3`, 'x:ref', { name: 'x' })] })] })
  it('★ 形狀相同：照走訪順序對到新的 id', () => {
    expect(carryTypes(tree('a', 'int'), { a3: 'int', a1: 'int' }, tree('b', 'int'))).toEqual({ b3: 'int', b1: 'int' })
  })
  it('🔴 形狀不同（int 改成 double）：回 null，不沿用過期的型別', () => {
    expect(carryTypes(tree('a', 'int'), { a3: 'int' }, tree('b', 'double'))).toBeNull()
  })
  it('同一棵樹：原樣', () => {
    const t = tree('a', 'int')
    expect(carryTypes(t, { a3: 'int' }, t)).toEqual({ a3: 'int' })
  })
})
