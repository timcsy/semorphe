/**
 * **組裝漏了一步時，它必須出聲。**
 *
 * ## 它從哪來（2026-08-26）
 *
 * 路線圖「核心可獨立出貨」的子項逐字：
 *
 * > 「膠囊的 lift 策略、產生器（`pack.install()`）今天都要消費者自己登記，
 * >  而**漏掉的症狀是降級不是錯誤**：`if` 變 `unresolved`、
 * >  產出變 `⟨unknown component⟩`」
 *
 * 而 `examples/bring-your-own-view/src/main.ts` 是那個症狀的現場——
 * 它的兩段註解逐字寫著「少了這一步……**而程式不會報錯**」。
 *
 * ## 🔴 這支釘的是【分界】，不是「有沒有報錯」
 *
 * ```
 * 套件不存在        未知語言      → 誠實降級，保住內容（FR-014 的既有契約）
 * 套件在而沒產生器  忘了 install  → 出聲
 * ```
 *
 * > **一個從來沒被宣告過的語言，與一個宣告了而沒接上的語言，
 * > 產出同一種字串——而只有後者是缺陷。**
 *
 * ⚠️ 第一版把兩者一起 `throw`，當場被 FR-014 那支擋下來：throw 把內容整個弄丟，
 * **比降級更糟**——那正是 P6 要擋的反面。
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測 lift 那一路**——膠囊的辨識策略現在由 `LiftStrategyRegistry`
 *   的建構子自己長出來（收成一個入口），而守它的是那些膠囊自證測試。
 * - **不檢測「登記了但登記錯」**——只問「一個都沒有」。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { generateCode } from '../../src/core/projection/code-generator'
import { createNode } from '../../src/core/semantic-tree'
import { languagePack } from '../../src/core/language-packs'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { StylePreset } from '../../src/core/types'

const style = apcs as unknown as StylePreset

beforeAll(async () => {
  // ⚠️ 只載入**套件宣告**，刻意**不呼叫** `install()`——那正是要測的狀態。
  await import('../../src/languages/cpp/pack')
})

describe('組裝漏了一步時要出聲', () => {
  it('★ 錨點：那個語言的套件真的宣告過了（否則下面測到的是「未知語言」）', () => {
    expect(languagePack('cpp'), 'cpp 套件沒宣告 → 下面兩支測的是另一件事').toBeTruthy()
    expect(languagePack('__nope__'), '這個名字不該有套件').toBeFalsy()
  })

  it('🔴 有套件而一個產生器都沒註冊 → 出聲，並指名是哪一步漏了', () => {
    let msg = ''
    try {
      generateCode(createNode('cpp:program', {}, { body: [] }), 'cpp', style)
    } catch (e) {
      msg = String((e as Error).message)
    }
    expect(msg,
      '🔴 沒有出聲——於是每一顆節點都會退成 `⟨unknown component: …⟩`，\n'
      + '   而那**看起來像語義樹壞了**，實際上是組裝點漏了一步。')
      .toContain('pack.install()')
  })

  it('🔴 而未知語言【不得】出聲——它要誠實降級並保住內容（FR-014）', () => {
    // ⚠️ 這一支是上面那一支的反面。少了它，「出聲」會被寫成
    //    「沒有產生器就 throw」，而那會讓一個沒有語言套件的宿主
    //    **弄丟使用者的註解**。
    const out = generateCode(createNode('cpp:comment', { text: '不該消失' }), '__nope__', style)
    expect(out, '未知語言時內容被弄丟了').toContain('不該消失')
  })
})
