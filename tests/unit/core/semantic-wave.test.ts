/**
 * **語意波**——`core/semantic-wave.ts`。
 *
 * 🔴 它是第五刀 ③ 的驗收判準：**這一課有沒有下沉再上浮？**
 * 而那比「七個步驟都要有」好驗得多。
 */
import { describe, it, expect } from 'vitest'
import { waveOf, abstraction, LESSON_VIEWS, type LessonView } from '../../../src/core/semantic-wave'

describe('語意軸', () => {
  it('★ 入口條件：五個看法都有位置，而它們不全同高', () => {
    const hs = LESSON_VIEWS.map(abstraction)
    expect(new Set(hs).size, '🔴 全部同高 → 任何序列都不是波，這個判準等於沒有').toBeGreaterThan(1)
  })

  it('程式碼最抽象、流程最具體', () => {
    expect(abstraction('code')).toBeGreaterThan(abstraction('blocks'))
    expect(abstraction('blocks')).toBeGreaterThan(abstraction('flow'))
  })

  it('⚠️ 對照與三欄同高——它們同時給抽象與具體，那是波的【中間】', () => {
    expect(abstraction('compare')).toBe(abstraction('three'))
  })
})

describe('是不是一條波', () => {
  const w = (...v: LessonView[]) => waveOf(v)

  it('🟢 下沉再上浮 ＝ 波', () => {
    expect(w('code', 'blocks', 'code').isWave).toBe(true)
    expect(w('compare', 'flow', 'compare', 'code').isWave).toBe(true)
  })

  it('🔴 一直待在同一層 ＝ 平的（而研究說那教學效果差）', () => {
    expect(w('blocks', 'blocks', 'blocks').isWave).toBe(false)
    expect(w('code', 'code').isWave).toBe(false)
  })

  it('🔴 只下沉沒上浮 ＝ 拆開了而沒有收回來', () => {
    const s = w('code', 'compare', 'flow')
    expect(s.descends).toBe(true)
    expect(s.ascends).toBe(false)
    expect(s.isWave).toBe(false)
  })

  it('🔴 先上浮再下沉【不算】——語意波要的是先拆開再收回', () => {
    expect(w('flow', 'code').isWave).toBe(false)
    expect(w('blocks', 'code').ascends, '🔴 沒下沉過就算上浮 → 任何往上的一步都會過關').toBe(false)
  })

  it('⚠️ 少於兩步一律不是波，而那不是錯——它只是還沒有這個宣告', () => {
    expect(w().isWave).toBe(false)
    expect(w('code').isWave).toBe(false)
  })

  it('★ 紅的時候印得出高度序列——不然沒有人知道它為什麼不是波', () => {
    expect(w('code', 'blocks', 'code').levels).toEqual([3, 1, 3])
  })
})
