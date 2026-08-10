/**
 * **走一次投影，身分不得改變**
 *
 * ## 為什麼這一支存在
 *
 * 來回轉換的測試比的是**產出的程式碼**。而程式碼一樣、身分不一樣的時候，
 * 它們**全部都是綠的**——因為 `cpp:if` 與 `cpp:if_else` 產出的碼一模一樣。
 *
 * 這支測試問的是不同的問題：**同一顆節點走一次 render → extract，
 * 回來的還是同一個身分嗎？**
 *
 * ## 已釘住的缺陷：降級目標走一次投影就換身分
 *
 * ```
 * cpp:if_else --render--> u_if_else 積木（內容完整）--extract--> cpp:if
 *                                                                ↑ 身分變了
 * ```
 *
 * 機制是三件事疊起來：
 *
 * 1. `Blockly.Blocks['u_if_else'] = Blockly.Blocks['u_if']`（`block-registrar.ts:1068`）
 *    ——`u_if_else` 是 `u_if` 的**別名**，同一個物件
 * 2. `extractor.registerExtractStrategy('u_if_else', extractIf)`
 *    （`extract-strategies.ts:71`）——兩個型別共用同一支抽取策略
 * 3. 而 `extractIf` 回傳 `createNode('cpp:if', …)`（同檔 :64）——寫死的身分
 *
 * ## 為什麼它是**靜默**的
 *
 * `cpp:if_else` 是**降級目標**（`skipPaths: ['lift']`、
 * `skipReasons.lift = 'degradation-target'`），由 `cpp:ternary` 在概念不可用時
 * 降級抵達。它不出現在任何原始碼裡，所以：
 *
 * - **辨識**那一路測不到它（它本來就不該被 lift 出來）
 * - **產生**那一路看不出差別（`cpp:if` 與 `cpp:if_else` 產出的碼相同）
 * - **來回轉換**的測試比碼，所以也是綠的
 *
 * 三十條護欄沒有一條看得見它。而它改變的是**語義樹的身分**——
 * `concepts/等價與觀察集.md`：「外延等價是可以收回的觀察；**內涵身分是收不回的承諾**」。
 *
 * ## 為什麼用 `it.fails` 而不是 `it.skip`
 *
 * `it.skip` 不會跑——修好了也沒有人知道。`it.fails` **會跑**：
 * 缺陷還在時它是綠的（且這段註解在原地出聲），修好的那天它**變紅並提醒拔釘子**。
 *
 * ⚠️ 而 `it.fails` 原本對缺陷帳是**隱形的**（掃描只認 `todo`／`skip`）——
 * 這一輪一併補上，理由與「跨行寫的停用宣告」同一條：
 * **一筆看不見的缺陷，與一筆不存在的缺陷，在報表上長得一模一樣。**
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { setupTestRenderer } from '../helpers/setup-renderer'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { renderToBlocklyState } from '../../src/core/projection/block-renderer'
import { PatternExtractor } from '../../src/core/projection/pattern-extractor'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { registerCppExtractStrategies } from '../../src/languages/cpp/extractors/extract-strategies'
import { allCppConcepts, allCppProjections } from '../../src/languages/cpp/all-declarations'
import { createNode } from '../../src/core/semantic-tree'
import type { SemanticNode } from '../../src/core/types'

let extractor: PatternExtractor

beforeAll(() => {
  registerCppLanguage()
  setupTestRenderer()
  const reg = new BlockSpecRegistry()
  reg.loadFromSplit(allCppConcepts() as never, allCppProjections() as never)
  extractor = new PatternExtractor()
  extractor.loadBlockSpecs(reg.getAll())
  registerCppExtractStrategies(extractor)
})

/** 走一次 render → extract，回傳頂層節點的身分。 */
function 走一圈的身分(node: SemanticNode): string | null {
  const st = renderToBlocklyState(createNode('cpp:program', {}, { body: [node] }))
  const back = (st.blocks.blocks as never[]).map((b) => extractor.extract(b as never)).filter(Boolean) as SemanticNode[]
  return back[0]?.conceptId ?? null
}

const 條件 = (): SemanticNode => createNode('cpp:literal_number', { value: '1' })
const 一句 = (n: string): SemanticNode => createNode('cpp:var_declare', { name: n, type: 'int' })

describe('走一次投影，身分不得改變', () => {
  // ── 對照組：正常的元件不會換身分 ─────────────────────────
  //
  // 不可省。沒有它，一個「什麼都回 null」的量測也會讓下面那條 `it.fails` 綠。
  it('★ 對照組：cpp:if 走一圈之後還是 cpp:if', () => {
    const 身分 = 走一圈的身分(
      createNode('cpp:if', {}, { condition: [條件()], then_body: [一句('a')] }),
    )
    expect(身分, '連 cpp:if 都換身分 → 量測壞了，不是缺陷').toBe('cpp:if')
  })

  it('★ 對照組：cpp:loop_while 走一圈之後還是 cpp:loop_while', () => {
    const 身分 = 走一圈的身分(
      createNode('cpp:loop_while', {}, { condition: [條件()], body: [一句('a')] }),
    )
    expect(身分).toBe('cpp:loop_while')
  })

  // ── 已釘住的缺陷 ────────────────────────────────────────
  it.fails('[BLOCKED:cpp:if_else] 降級目標 cpp:if_else 走一圈之後還是 cpp:if_else', () => {
    // 🔴 **實測會拿到 `cpp:if`**。見檔頭的三段機制。
    //
    // 修法有兩條路，而它們的代價不同：
    //
    // ① **讓 `extractIf` 依積木型別回傳對應的身分**（`u_if` → `cpp:if`、
    //    `u_if_else` → `cpp:if_else`）。最小改動，但要順帶處理子節點名
    //    （`then_body`／`else_body` vs `then`／`else`）。
    //
    // ② **讓 `cpp:if_else` 不再需要自己的積木型別**——如果降級之後顯示成
    //    `u_if` 就夠，那 `u_if_else` 這個別名可以整個退場，
    //    而 `cpp:if_else` 只留在語義層當抽象父概念。
    //
    // ⚠️ ② 要先答一個問題：**降級成 `cpp:if_else` 的節點，需要與 `cpp:if`
    //    在畫面上分得出來嗎？** 那是教學決定，不是技術決定。
    const 身分 = 走一圈的身分(
      createNode('cpp:if_else', {}, {
        condition: [條件()],
        then: [一句('a')],
        else: [一句('b')],
      }),
    )
    expect(身分).toBe('cpp:if_else')
  })

  it('★ 釘住現況：它現在變成什麼（缺陷修好時這一條也要一起拔）', () => {
    // 上面那條 `it.fails` 只說「不是 if_else」。這一條說**是什麼**——
    // 沒有它，任何一種錯誤身分都會讓那條保持綠色，包括「回傳 null」。
    const 身分 = 走一圈的身分(
      createNode('cpp:if_else', {}, { condition: [條件()], then: [一句('a')], else: [一句('b')] }),
    )
    expect(身分, '現況變了 → 去看那條 it.fails 是不是可以拔釘子了').toBe('cpp:if')
  })

  it('★ 內容沒有跟著掉——身分換了，而子節點是完整的', () => {
    // 這一條界定缺陷的**範圍**：它只換身分，不掉資料。
    // 沒有這條的話，未來有人修身分時不會知道內容本來就是好的。
    const st = renderToBlocklyState(
      createNode('cpp:program', {}, {
        body: [createNode('cpp:if_else', {}, { condition: [條件()], then: [一句('a')], else: [一句('b')] })],
      }),
    )
    const back = (st.blocks.blocks as never[]).map((b) => extractor.extract(b as never)).filter(Boolean) as SemanticNode[]
    const 收集 = (n: SemanticNode, out: string[] = []): string[] => {
      out.push(n.conceptId)
      for (const ks of Object.values(n.children ?? {})) for (const k of ks) 收集(k, out)
      return out
    }
    const 全部 = back.flatMap((b) => 收集(b))
    expect(全部.filter((x) => x === 'cpp:var_declare'), 'then 與 else 兩句都要在').toHaveLength(2)
    expect(全部).toContain('cpp:literal_number')
  })
})
