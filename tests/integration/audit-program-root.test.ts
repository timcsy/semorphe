/**
 * spec 171：**程式根要跟著語言走**。
 *
 * ## 使用者回報（2026-08-21）
 *
 * 切到 Python、跑完程式之後，程式碼面板顯示：
 *
 * ```
 * ⟨unknown component: cpp:program⟩
 * ```
 *
 * 積木是 Python 的、執行結果是對的（主控台印出 2 3 5 7 11 13 17 19），
 * **而語義樹的根是 `cpp:program`**。
 *
 * ## 根因
 *
 * 組裝點**寫死 import** 了 C++ 的程式根建構子（`app.ts` 的 `buildProgramRoot`），
 * 而它在應用建構時注入一次、**切語言時不會變**。
 *
 * > **一個在啟動時決定的「哪一顆是根」，遇到「隨時可以切語言」的選單就會過期。**
 *
 * ⚠️ 而它**只在【積木→程式碼】那個方向出現**——貼程式碼進來時根是 lift 出來的，
 * 是對的。所以使用者看到的是「有時候」。
 *
 * > **一個只在單一方向上壞掉的缺陷，在另一個方向上看起來完全正常。**
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT } from '../helpers/guardrail'
import { loadAllLanguagePacks } from '../../src/core/load-language-packs'
import { allLanguagePacks } from '../../src/core/language-packs'
import { componentComponents } from '../../src/core/component/registry'

describe('spec 171 · 程式根要跟著語言走', () => {
  it('★ 錨點：語言套件掃得到（否則下面在驗空集合）', () => {
    loadAllLanguagePacks()
    expect(allLanguagePacks().length, '一個語言套件都沒有 → 下面每一條都無意義')
      .toBeGreaterThan(1)
  })

  it('🔴 每個語言套件都要宣告自己的程式根', () => {
    loadAllLanguagePacks()
    const missing = allLanguagePacks()
      .filter((p) => !(p as { programRoot?: string }).programRoot)
      .map((p) => p.id)
    expect(missing,
      '🔴 沒宣告的話，組裝點只能用「第一個宣告了 programRoot 的元件」——'
      + '而那會挑到別的語言的').toEqual([])
  })

  it('🔴 宣告的那顆必須真的存在，而且它自己也說它是根', () => {
    loadAllLanguagePacks()
    const ids = new Set((componentComponents() as { componentId: string }[]).map((c) => c.componentId))
    const traits = new Map((componentComponents() as { componentId: string; traits?: Record<string, unknown> }[])
      .map((c) => [c.componentId, c.traits]))
    const bad: string[] = []
    for (const p of allLanguagePacks()) {
      const root = (p as { programRoot?: string }).programRoot
      if (!root) continue
      if (!ids.has(root)) bad.push(`${p.id}：宣告的 ${root} 不存在`)
      else if (traits.get(root)?.programRoot !== true) {
        bad.push(`${p.id}：${root} 沒有宣告 traits.programRoot`)
      }
    }
    // ⚠️ **兩份宣告要互相對得上**——套件說「我的根是它」，元件說「我是根」。
    //    少了這一條，兩邊漂開時不會有人發現。
    expect(bad, '套件的宣告與元件的宣告對不上').toEqual([])
  })

  it('🔴 反向：每一顆宣告自己是根的元件，都要有某個套件認領它', () => {
    loadAllLanguagePacks()
    const claimed = new Set(allLanguagePacks()
      .map((p) => (p as { programRoot?: string }).programRoot).filter(Boolean))
    const orphans = (componentComponents() as { componentId: string; traits?: Record<string, unknown> }[])
      .filter((c) => c.traits?.programRoot === true && !claimed.has(c.componentId))
      .map((c) => c.componentId)
    // 一顆沒有人認領的程式根 = 一個永遠不會被用到的根，而它看起來很正常。
    expect(orphans, '這些元件說自己是程式根，而沒有任何語言套件用它').toEqual([])
  })

  it('🔴 組裝點不得寫死某一顆程式根的建構子', () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'src/ui/app.ts'), 'utf8')
    expect(/from\s+'\.\.\/components\/\w+\/program\/lift'/.test(src),
      '🔴 `buildProgramRoot` 寫死 import 一個語言的建構子 → 切語言時它不會變。'
      + '\n   症狀：程式碼面板顯示 ⟨unknown component: xxx:program⟩').toBe(false)
  })
})
