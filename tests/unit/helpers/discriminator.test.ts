/**
 * 判別式與互斥判定的單元測試（T007）
 *
 * 誤報風險全集中在這裡——判錯了，第五條護欄的數字就不可信。
 * 所以它自己要有測試。
 */
import { describe, it, expect } from 'vitest'
import { extractDiscriminators, provablyDisjoint, classifyPair, type RuleLike } from '../../helpers/discriminator'

const rule = (o: Partial<RuleLike> & { conceptId: string }): RuleLike => ({
  patternType: 'simple', priority: 10, ...o,
})

describe('extractDiscriminators：判別式不只在限定條件裡', () => {
  it('從限定條件萃取', () => {
    const d = extractDiscriminators(rule({
      conceptId: 'x',
      constraints: [{ field: 'operator', text: '+' }, { field: 'left', nodeType: 'identifier' }],
    }))
    expect(d).toEqual([
      { dimension: 'field:operator', kind: 'exact', value: '+' },
      { dimension: 'field:left', kind: 'nodeType', value: 'identifier' },
    ])
  })

  it('★ 從 chain 萃取——這是最容易漏的一層', () => {
    const d = extractDiscriminators(rule({
      conceptId: 'lang:print', patternType: 'chain',
      chain: { operator: '<<', rootMatch: { text: 'cout' } },
    }))
    expect(d.map(x => x.dimension).sort()).toEqual(['chain:operator', 'chain:rootText'])
  })

  it('從 operatorDispatch 萃取運算子集合', () => {
    const d = extractDiscriminators(rule({
      conceptId: 'x', patternType: 'operatorDispatch',
      operatorDispatch: { routes: { '+': 'a', '-': 'b' } },
    }))
    expect(d).toEqual([{ dimension: 'dispatch:operators', kind: 'set', value: '+|-' }])
  })

  it('從 composite 萃取每個 check', () => {
    const d = extractDiscriminators(rule({
      conceptId: 'x', patternType: 'composite',
      composite: { checks: [{ field: 'value', typeIs: 'call_expression' }] },
    }))
    expect(d).toEqual([{ dimension: 'composite:value', kind: 'nodeType', value: 'call_expression' }])
  })
})

describe('provablyDisjoint：只有證明得出來才回 true', () => {
  const D = (dimension: string, kind: any, value: string) => ({ dimension, kind, value })

  it('exact 值不同 → 互斥', () => {
    expect(provablyDisjoint(D('f:a', 'exact', 'x'), D('f:a', 'exact', 'y'))).toBe(true)
  })
  it('exact 值相同 → 證不出互斥', () => {
    expect(provablyDisjoint(D('f:a', 'exact', 'x'), D('f:a', 'exact', 'x'))).toBe(false)
  })
  it('不同維度 → 證不出互斥（不是「證明會撞」）', () => {
    expect(provablyDisjoint(D('f:a', 'exact', 'x'), D('f:b', 'exact', 'y'))).toBe(false)
  })
  it('exact 不以 prefix 開頭 → 互斥', () => {
    expect(provablyDisjoint(D('f:a', 'exact', 'abc'), D('f:a', 'prefix', 'z'))).toBe(true)
  })
  it('exact 以 prefix 開頭 → 證不出互斥', () => {
    expect(provablyDisjoint(D('f:a', 'exact', 'abc'), D('f:a', 'prefix', 'ab'))).toBe(false)
  })
  it('兩個運算子集合不相交 → 互斥', () => {
    expect(provablyDisjoint(D('d:o', 'set', '+|-'), D('d:o', 'set', '*|/'))).toBe(true)
  })
  it('兩個運算子集合相交 → 證不出互斥', () => {
    expect(provablyDisjoint(D('d:o', 'set', '+|-'), D('d:o', 'set', '-|*'))).toBe(false)
  })
})

describe('classifyPair：三分類', () => {
  it('★ print vs input 必須是 never——它們是專案最常用的兩條規則', () => {
    const print = rule({ conceptId: 'lang:print', patternType: 'chain', priority: 105,
      chain: { operator: '<<', rootMatch: { text: 'cout' } } })
    const input = rule({ conceptId: 'lang:input', patternType: 'chain', priority: 105,
      chain: { operator: '>>', rootMatch: { text: 'cin' } } })
    const v = classifyPair(print, input)
    expect(v.verdict, `誤報這一對會讓維護者立刻學會忽略整個護欄。理由：${v.reason}`).toBe('never')
    expect(v.reason).toContain('互斥')
  })

  it('兩條都沒有判別式 → definitely', () => {
    const v = classifyPair(rule({ conceptId: 'a' }), rule({ conceptId: 'b' }))
    expect(v.verdict).toBe('definitely')
  })

  it('★ 判別式完全相同 → definitely（不是 unknown）', () => {
    // 實測：5 條規則的限定條件都是 { type: template_type }。
    // 第一版判定程序把它判成 unknown——但這是**最嚴重**的一種：
    // 先登記的贏走全部，其餘永遠不會被試到。
    const c = [{ field: 'type', nodeType: 'template_type' }]
    const v = classifyPair(
      rule({ conceptId: 'cpp:vector_declare', patternType: 'constrained', constraints: c }),
      rule({ conceptId: 'cpp:map_declare', patternType: 'constrained', constraints: c }),
    )
    expect(v.verdict).toBe('definitely')
    expect(v.reason).toContain('永遠不會被試到')
  })

  it('一方的限定條件是另一方的子集 → definitely', () => {
    const v = classifyPair(
      rule({ conceptId: 'loose', constraints: [{ field: 'type', text: 'int' }] }),
      rule({ conceptId: 'strict', constraints: [{ field: 'type', text: 'int' }, { field: 'x', text: 'y' }] }),
    )
    expect(v.verdict).toBe('definitely')
  })

  it('★ 不同 field 的限定條件 → unknown，不得樂觀歸 never', () => {
    const v = classifyPair(
      rule({ conceptId: 'a', constraints: [{ field: 'x', text: '1' }] }),
      rule({ conceptId: 'b', constraints: [{ field: 'y', text: '2' }] }),
    )
    expect(v.verdict, '判不出來就說判不出來——保守是刻意的').toBe('unknown')
  })

  it('一邊有判別式一邊沒有 → definitely（空集合是任何集合的子集）', () => {
    // 這條的預期在實作中被更正過。原本寫 unknown，理由是「證不出必撞」——
    // 但那是錯的：沒有限定條件的那條會匹配該語法的**全部**情形，所以
    // **任何滿足另一條的輸入，必然也滿足它**。兩者必定同時認領。
    const v = classifyPair(
      rule({ conceptId: 'a', constraints: [{ field: 'x', text: '1' }] }),
      rule({ conceptId: 'b' }),
    )
    expect(v.verdict).toBe('definitely')
  })
})
