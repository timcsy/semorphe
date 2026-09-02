/**
 * 🔴 主控台可以關，而它必須叫得回來（spec 171 · T003）。
 *
 * 🪦 它反轉了第八十一條護欄的 I4「state 不得缺席」。
 *
 * > 「不准關」是一條擋住使用者的規範；而「一定回得來」才是那條規範
 * > 真正要保護的東西——使用者看不到程式在說什麼。
 */
import { describe, it, expect } from 'vitest'
import { revealForOutput, type ConsoleSurface } from '../../../src/core/host/console-surface'

function fake(hidden: boolean): ConsoleSurface & { shown: number; hidden_: boolean } {
  return {
    shown: 0,
    hidden_: hidden,
    show() { this.shown++; this.hidden_ = false },
    hide() { this.hidden_ = true },
    isHidden() { return this.hidden_ },
  }
}

describe('有輸出就自己回來', () => {
  it('🔴 關著的時候，一有輸出就叫回來', () => {
    const s = fake(true)
    expect(revealForOutput(s)).toBe(true)
    expect(s.shown).toBe(1)
    expect(s.isHidden()).toBe(false)
  })

  it('🔴 已經開著就【不要動它】——印一百行不該跳一百次', () => {
    const s = fake(false)
    expect(revealForOutput(s)).toBe(false)
    expect(s.shown).toBe(0)
  })

  it('🔴 叫回來之後，後續的輸出不再重複叫', () => {
    const s = fake(true)
    revealForOutput(s)
    revealForOutput(s)
    revealForOutput(s)
    expect(s.shown, '印三次叫了不只一次').toBe(1)
  })

  it('⚠️ 沒有表面時不得拋——那個宿主可能根本沒有可關的主控台', () => {
    expect(() => revealForOutput(null)).not.toThrow()
    expect(revealForOutput(undefined)).toBe(false)
  })
})
