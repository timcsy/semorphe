/** `withRanByParts`：宣告子跑過 ⟹ 那一句宣告跑過；本體跑過不往上推。 */
import { describe, it, expect } from 'vitest'
import { createNode } from '../../../src/core/semantic-tree'
import { withRanByParts } from '../../../src/core/coverage'
import '../../../src/languages/cpp/generators'

describe('執行覆蓋', () => {
  it('多宣告子：Cella 只記得宣告子，外層那句也算跑過', () => {
    const a = createNode('cpp:var_declare', { name: 'a', type: 'int' })
    const b = createNode('cpp:var_declare', { name: 'b', type: 'int' })
    const both = createNode('cpp:var_declare', { type: 'int' }, { declarators: [a, b] })
    const root = createNode('cpp:program', {}, { body: [both] })
    const v = withRanByParts(root, [a.id, b.id])
    expect(v.has(both.id)).toBe(true)
  })
  it('if 的另一支沒跑到：本體不往上推、兄弟不受影響', () => {
    const yes = createNode('cpp:print', {}, { values: [] })
    const no = createNode('cpp:print', {}, { values: [] })
    const iff = createNode('cpp:if', {}, { condition: [], then_body: [yes], else_body: [no] })
    const root = createNode('cpp:program', {}, { body: [iff] })
    const v = withRanByParts(root, [yes.id])
    expect(v.has(no.id)).toBe(false)
    // 正向錨點：跑過的那一支還在
    expect(v.has(yes.id)).toBe(true)
  })
  it('沒有樹：原樣', () => {
    expect([...withRanByParts(null, ['x'])]).toEqual(['x'])
  })
})
