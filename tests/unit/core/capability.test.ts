/**
 * 能力的兩個唯一入口。
 *
 * 🔴 **兩條預設規則的方向是這一刀最容易寫反的地方**，所以兩個方向各釘一支：
 *
 * ```
 * 元件沒宣告 needsCapability  → 所有板子都有它
 * 目標沒宣告 provides         → 它提供全部
 * ```
 *
 * 任何一條寫反，症狀都是**整批東西消失**而不是一顆——而那在畫面上看起來
 * 像「工具箱壞了」，不像「一個布林寫反了」。
 */
import { describe, it, expect } from 'vitest'
import { capabilityOf, targetProvides } from '../../../src/core/component/traits'

describe('capabilityOf', () => {
  it('★ 錨點：一顆真實元件查得到（證明登錄表載入了）', () => {
    // ⚠️ 用一顆**一定存在且一定不挑板子**的——它的回答是 undefined，
    //    而那與「查不到」同形，所以這一支只證明「不會拋錯」。
    expect(() => capabilityOf('cpp:pin_mode')).not.toThrow()
  })

  it('沒宣告的元件回 undefined（＝所有板子都有）', () => {
    expect(capabilityOf('cpp:pin_mode')).toBeUndefined()
  })

  it('查不到的身分回 undefined，不拋錯', () => {
    expect(capabilityOf('nope:nothing')).toBeUndefined()
  })
})

describe('targetProvides', () => {
  const limited = { provides: ['touch'] }
  const open = {}

  it('元件不挑板子 → 任何目標都通', () => {
    expect(targetProvides(limited, undefined)).toBe(true)
    expect(targetProvides({ provides: [] }, undefined)).toBe(true)
  })

  it('🔴 目標沒宣告 provides → 提供全部', () => {
    // 反了的話，三個既有的非硬體目標會整批清空（FR-006）
    expect(targetProvides(open, 'touch')).toBe(true)
    expect(targetProvides(open, 'anything-at-all')).toBe(true)
  })

  it('目標有限縮 → 只通它列出來的', () => {
    expect(targetProvides(limited, 'touch')).toBe(true)
    expect(targetProvides(limited, 'ledc-pwm')).toBe(false)
  })

  it('🔴 空陣列 ≠ 省略——空陣列是「一個都不提供」', () => {
    // ⚠️ Uno／Nano 用的就是 `[]`。把它和 undefined 當成一樣的話，
    //    這一刀等於什麼都沒做。
    expect(targetProvides({ provides: [] }, 'touch')).toBe(false)
  })
})
