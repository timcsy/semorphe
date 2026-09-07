/**
 * **跨課的曲線**（拆輪子）——⚠️ 它與語意波**方向相反**，而兩者都對。
 *
 * ```
 * 語意波   一【課】之內   先下到具體，再回到抽象
 * 曲線     一【軌】之間   往程式碼那一頭走，不回頭
 * ```
 */
import { describe, it, expect } from 'vitest'
import { curveOf, abstraction } from '../../../src/core/semantic-wave'

describe('拆輪子的曲線', () => {
  it('軸的方向：程式碼最抽象，流程最具體', () => {
    expect(abstraction('code')).toBeGreaterThan(abstraction('compare'))
    expect(abstraction('compare')).toBeGreaterThan(abstraction('blocks'))
    expect(abstraction('blocks')).toBeGreaterThan(abstraction('flow'))
  })

  it('🟢 一條真的曲線：積木 → 對照 → 程式碼', () => {
    const c = curveOf(['blocks', 'blocks', 'compare', 'compare', 'code'])
    expect(c.moves).toBe(true)
    expect(c.regresses).toBe(false)
    expect(c.regressAt).toEqual([])
  })

  /**
   * 🔴 **倒退 ＝ 鷹架又裝回去了。**
   */
  it('🔴 倒退抓得到，而且說得出在第幾步', () => {
    const c = curveOf(['compare', 'code', 'blocks'])
    expect(c.regresses).toBe(true)
    expect(c.regressAt).toEqual([2])
    expect(c.levels, '🔴 紅的時候要印得出高度序列').toEqual([2, 3, 1])
  })

  /**
   * ⚠️ 一整軌同一個看法是**合法的**——那條軌道沒有宣告曲線的意圖，
   * 而「沒有意圖」不是錯。
   */
  it('⚠️ 全部一樣 → 不算移動，也不算倒退', () => {
    const c = curveOf(['blocks', 'blocks', 'blocks'])
    expect(c.moves).toBe(false)
    expect(c.regresses).toBe(false)
  })

  it('空的與一步的，都不是曲線也不是錯', () => {
    expect(curveOf([]).regresses).toBe(false)
    expect(curveOf(['code']).moves).toBe(false)
  })

  it('★ `compare` 與 `three` 同高 → 它們之間換不算移動也不算倒退', () => {
    const c = curveOf(['compare', 'three', 'compare'])
    expect(c.moves).toBe(false)
    expect(c.regresses).toBe(false)
  })
})
