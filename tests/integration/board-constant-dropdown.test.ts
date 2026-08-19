/**
 * spec 148：**下拉的名單由誰算**——資料那一半。
 *
 * ⚠️ **接線那一半在 `e2e/board-constant-dropdown.spec.ts`**，不在這裡。
 * 這一支量得到「算得對不對」，量不到「有沒有人接上」
 * ——而這個專案已經撞過四次「機制有了沒人接上」。
 */
import { describe, it, expect } from 'vitest'
import { boardConstantOptions, allBoardConstantDropdowns } from '../../src/core/board-constant-dropdown-blocks'
import type { BoardPinModel } from '../../src/core/types'
import { registerCppLanguage } from '../../src/languages/cpp/generators/index'

// ⚠️ **匯入不等於註冊**——宣告住在 `registerCppLanguage()` 裡面。
//    第一版只 import 就斷言，於是錨點紅了：那正是錨點該做的事。
registerCppLanguage()
import esp32 from '../../src/languages/cpp/targets/esp32.json'
import d1mini from '../../src/languages/cpp/targets/wemos-d1-mini.json'
import pinConstantForms from '../../src/components/cpp/pin_constant/forms/blocks.json'

const boardOf = (t: { board: unknown }) => t.board as unknown as BoardPinModel

describe('spec 148 · 名單怎麼算', () => {
  it('★ 錨點：語言套件真的宣告了這顆積木（否則下面全是空談）', () => {
    const d = allBoardConstantDropdowns().find((x) => x.blockType === 'cpp_pin_constant')
    expect(d, '沒有人宣告 cpp_pin_constant 要用板子常數下拉').toBeTruthy()
    expect(d!.field).toBe('VALUE')
  })

  it('🔴 有板子 → 名單就是這塊板子的常數鍵，逐鍵相符', () => {
    expect(boardConstantOptions(boardOf(esp32))).toEqual(Object.keys(boardOf(esp32).constants))
    expect(boardConstantOptions(boardOf(d1mini))).toContain('D1')
    expect(boardConstantOptions(boardOf(esp32))).not.toContain('D1')
  })

  it('🔴 沒有板子 → `null`（意思是「用宣告裡那份」，而不是複製一份出來）', () => {
    // > 一份宣告如果是另一份的投影，它就沒有資格當真相。
    expect(boardConstantOptions(undefined)).toBeNull()
  })

  it('⚠️ 不排序——`HIGH`／`LOW` 在前是刻意的', () => {
    const names = boardConstantOptions(boardOf(esp32))!
    expect(names[0]).toBe('HIGH')
    expect(names, '排序過了，最常用的被推到 A10 後面').not.toEqual([...names].sort())
  })

  it('🔴 `A0` 不得留在宣告裡——它是【板子】的東西', () => {
    const opts = pinConstantForms[0].blockDef.args0[0].options as string[][]
    expect(opts.map((o) => o[1]), '靜態選項又長出 A0——那會是過期的那一份').not.toContain('A0')
    // ★ 反向：而其餘五個要在（它們是「沒有板子」那些目標的真相）
    expect(opts.map((o) => o[1])).toEqual(['HIGH', 'LOW', 'OUTPUT', 'INPUT', 'INPUT_PULLUP'])
  })
})
