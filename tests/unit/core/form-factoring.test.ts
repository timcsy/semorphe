/**
 * 形態的因子化——**軸之間條件獨立時，組合是導出的不是手寫的**。
 *
 * 🔴 判準來自 `Transformers learn factored representations`（arXiv 2602.02385）：
 * 因子化在因子條件獨立時**無損**，否則犧牲保真度。
 * 而在形態上，「條件獨立」的讀法是：**每條軸動的 `blockDef` 欄位彼此不相交**。
 */
import { describe, it, expect } from 'vitest'
import { changedFields, checkIndependence, deriveFactoredSpecs } from '../../../src/core/projection/form-factoring'
import type { BlockSpec } from '../../../src/core/types'

const spec = (id: string, type: string, def: Record<string, unknown>, form?: { axis: string; value: string }): BlockSpec =>
  ({ id, form, blockDef: { type, ...def }, componentMapping: { componentId: 'x:c' } } as unknown as BlockSpec)

describe('changedFields', () => {
  it('★ `type` 不算 —— 它是身分不是外觀', () => {
    expect([...changedFields({ type: 'a', m: 1 }, { type: 'b', m: 1 })]).toEqual([])
  })
  it('★ 值不同就算，包含新增與刪除', () => {
    expect([...changedFields({ m: 1 }, { m: 2 })]).toEqual(['m'])
    expect([...changedFields({ m: 1 }, {})]).toEqual(['m'])
    expect([...changedFields({}, { out: 'E' })]).toEqual(['out'])
  })
})

describe('checkIndependence', () => {
  it('🟢 兩條軸動不同欄位 → 交集空', () => {
    // ⚠️ 素材要是【完整的】blockDef —— 少一個鍵會被讀成「把它改成 undefined」。
    //    第一版寫成部分的，於是這條測試紅了，而紅的是測試不是實作。
    const r = checkIndependence({ msg: 'n', out: null }, new Map([
      ['kind', [{ msg: 's', out: null }]],
      ['role', [{ msg: 'n', out: 'E' }]],
    ]))
    expect(r.collisions).toEqual([])
    expect([...r.touched.get('kind')!]).toEqual(['msg'])
  })
  it('🔴 兩條軸動同一個欄位 → 指名那個交集', () => {
    const r = checkIndependence({ geo: 'base' }, new Map([
      ['lod', [{ geo: 'detailed' }]],
      ['用途', [{ geo: 'watertight' }]],
    ]))
    expect(r.collisions).toEqual(['lod×用途:geo'])
  })
})

describe('deriveFactoredSpecs', () => {
  const base = spec('b', 'blk', { msg: 'n', out: null })
  const kindS = spec('k', 'blk_s', { msg: 's', out: null }, { axis: 'kind', value: 's' })
  const roleE = spec('r', 'blk_e', { msg: 'n', out: 'E' }, { axis: 'role', value: 'e' })
  const g = spec('g', 'g', { geo: 'base' })

  it('🟢 獨立 → 組合是【導出】的，而且兩條軸的貢獻都在', () => {
    const { derived } = deriveFactoredSpecs([base, kindS, roleE])
    expect(derived).toHaveLength(1)
    const d = derived[0]!.blockDef as unknown as Record<string, unknown>
    expect(d.type, '命名依【軸名字母序】—— 刻意不依 priority').toBe('blk_s_e')
    expect(d.msg, '🔴 標籤要來自 kind 那條軸 —— 丟掉它就是「標籤說謊」').toBe('s')
    expect(d.out, '形狀要來自 role 那條軸').toBe('E')
  })

  it('🔴 `id` 必須換 —— 登錄表用它當鍵', () => {
    const { derived } = deriveFactoredSpecs([base, kindS, roleE])
    // 第一版繼承了 base 的 id，症狀不是報錯：是登錄表裡【少了三顆積木】。
    expect(derived[0]!.id).not.toBe(base.id)
  })

  it('🔴 不獨立就【不產生】，而且說得出交集', () => {
    const a = spec('a', 'g_d', { geo: 'd' }, { axis: 'lod', value: 'd' })
    const b = spec('b2', 'g_w', { geo: 'w' }, { axis: 'use', value: 'w' })
    const { derived, reports } = deriveFactoredSpecs([g, a, b])
    expect(derived, '有交集還產生的話，症狀是【安靜地組出一個錯的形態】').toHaveLength(0)
    expect(reports[0]!.collisions).toEqual(['lod×use:geo'])
  })

  it('★ 只有一條軸的不產生組合（絕大多數元件）', () => {
    expect(deriveFactoredSpecs([base, kindS]).derived).toHaveLength(0)
  })

  it('★ 已經手寫過的組合不重複產生', () => {
    const hand = spec('h', 'blk_s_e', { msg: 's', out: 'E' })
    expect(deriveFactoredSpecs([base, kindS, roleE, hand]).derived).toHaveLength(0)
  })
})
