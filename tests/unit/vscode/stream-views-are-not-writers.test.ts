/**
 * 🔴 **一個不投影任何東西的視圖，不該是一個寫入者。**
 *
 * ## 病歷（2026-09-02，Arduino IDE 實測）
 *
 * 使用者打字：「**為何這 hello 一直閃**？」——`cout << "hello"` 打進去，
 * 一秒後整份程式變回裸骨架 `int main() { return 0; }`。
 *
 * 主控台與變數搬進 panel 區之後，它們**各自是一個完整的 session**：收文件、
 * lift、回寫。而那兩個視窗裡**沒有積木工作區**——樹是空的，產生出來的是
 * 一份裸骨架，然後寫了回去。
 *
 * ```
 * 使用者打  cout << "hello"
 * 主控台視窗（樹是空的）→ 產生裸骨架 → applyEdit → hello 不見了
 * → 其他視窗重新 lift → 使用者再打一次 → 又不見
 * ```
 *
 * > **讓它變成寫入者的，是「每個視窗都是完整的 session」這個便利。**
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果四種視圖全都不是寫入者，這支測的就不是「哪些是」，
 * > 而是「一個永遠回 false 的函式」——所以第一條先釘住【有寫入者】。**
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isDocumentWriter } from '../../../src/vscode/vscode-profile'

const read = (rel: string): string => readFileSync(resolve(__dirname, '../../..', rel), 'utf8')

describe('資料流視圖不是文件的寫入者', () => {
  it('★ 入口條件：確實有寫入者——否則下面那條是空的', () => {
    expect(isDocumentWriter('blocks'), '積木不是寫入者的話，同步整條就斷了').toBe(true)
    expect(isDocumentWriter('flow')).toBe(true)
  })

  it('🔴 硬性零：主控台與變數都不得是寫入者', () => {
    const bad = (['console', 'variables'] as const).filter(isDocumentWriter)
    expect(bad, `這些視圖會回寫文件，而它們的樹是空的：\n  ${bad.join('\n  ')}`).toEqual([])
  })

  it('🔴 接線：`panel.ts` 真的在【兩個地方】問這件事', () => {
    // ⚠️ 少了任何一半都不夠：
    //    ① 建構時不跟文件 → 它根本算不出編輯（機制）
    //    ② 收到 applyEdit 不套 → 就算有一則漏過來也寫不進去（防守）
    const src = read('src/vscode/panel.ts')
    expect(src, '判準沒有從 `vscode-profile` 來——兩份會漂').toMatch(/isDocumentWriter/)
    expect(src.match(/this\.streamOnly/g) ?? [], '兩個地方要各問一次')
      .toHaveLength(2)
  })

  it('⚠️ 而它們仍然收得到【轉送】的輸出——不是被斷線', () => {
    // 🟢 不寫文件 ≠ 什麼都收不到：跑程式的那個視窗把輸出送給主行程，
    //    主行程轉給這兩個視圖（`consoleOut`／`variablesOut`）。
    const src = read('src/vscode/panel.ts')
    expect(src).toMatch(/sessions\.get\('console'\)\?\.sendConsoleOut/)
    expect(src).toMatch(/sessions\.get\('variables'\)\?\.sendVariablesOut/)
  })
})
