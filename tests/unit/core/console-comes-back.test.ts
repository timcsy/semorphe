/**
 * 🔴 主控台可以關，而它必須叫得回來（spec 171 · T003）。
 *
 * 🪦 它反轉了第八十一條護欄的 I4「state 不得缺席」。
 *
 * > 「不准關」是一條擋住使用者的規範；而「一定回得來」才是那條規範
 * > 真正要保護的東西——使用者看不到程式在說什麼。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { consoleRole, revealForOutput, type ConsoleSurface } from '../../../src/core/host/console-surface'

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

/**
 * 🔴 **同一個面板不能同時「畫」與「報」**——那不是兩個功能，那是一個迴圈。
 *
 * 病歷（2026-09-02，Arduino IDE）：主控台變成 panel 區的原生分頁之後，
 * 它把自己畫下來的每一個字又報回宿主，宿主再轉回來。使用者看到的是
 * 「字被銜接在之後」「一直閃」「卡在主控台，點其他的 tab 切不過去」。
 */
describe('畫的人不報回去，報的人不畫', () => {
  it('★ 入口條件：兩種角色都要存在——否則這條判準是一句廢話', () => {
    expect(consoleRole('panelBottom')).toBe('draw')
    expect(consoleRole('hostPanel')).toBe('report')
  })

  it('🔴 只有 `panelBottom` 是「自己畫」；其餘一律是「送出去」', () => {
    const surfaces = ['hostPanel', 'hostTerminal', 'hostStatusBar', 'hostTitleBar', 'panelToolbar']
    const wrong = surfaces.filter((s) => consoleRole(s) !== 'report')
    expect(wrong, `這些被當成「自己畫」，而畫它的是宿主：\n  ${wrong.join('\n  ')}`).toEqual([])
  })

  it('🔴 接線：`app.ts` 兩條資料流（主控台／變數）都問這個判準', () => {
    const src = readFileSync(resolve(__dirname, '../../..', 'src/ui/app.ts'), 'utf8')
    expect(src.match(/consoleRole\(/g) ?? [], '主控台與變數要各問一次')
      .toHaveLength(2)
  })

  it('🔴 而「畫的人」那一側【不得】接 onOutput——那就是回音圈本身', () => {
    // ⚠️ 範圍從「畫的人」那個標記到函式結束（下一個方法的檔頭）
    //    ——第一版從 `view.onConsoleOut` 開始切，而注入的那一行**在它上面**，
    //    於是注入沒有讓它紅。
    //
    // > **一條「這個區段裡不准有 X」的斷言，它的區段要涵蓋 X 放得進去的地方。**
    const src = readFileSync(resolve(__dirname, '../../..', 'src/ui/app.ts'), 'utf8')
    const start = src.indexOf('【畫的人】')
    expect(start, '找不到「畫的人」那一支 → 這條測的不是那段程式').toBeGreaterThan(0)
    const drawBranch = src.slice(start, src.indexOf('套用語系', start))
    expect(drawBranch, '畫的那一支裡出現了 onOutput → 它會把畫下來的又報出去')
      .not.toMatch(/onOutput|reportConsole/)
  })
})
