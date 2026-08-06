/**
 * `if_else` 的執行（066）
 *
 * ## 這個缺口是護欄找出來的，而我原本以為它是誤報
 *
 * 完備性護欄長期回報 `if_else.execute` 是 **❌ 缺**——五路裡唯一的一個「缺」。
 * 直覺上那不可能：if/else 是核心控制流程，每個程式都在用。
 *
 * **實測它是真的。** `if_else` 有概念定義、有產生器、有積木投影（`u_if_else`，
 * 使用者拖得到），**就是沒有執行器**。跑起來丟未知概念。
 *
 * 會動的那個是另一個概念 `if`（子節點叫 `then_body`／`else_body`）。
 * `if_else` 的子節點叫 `then`／`else`——**同一件事的兩個概念，只有一個能跑**。
 *
 * > 「每次照量測行動的第一步，都要準備好推翻它」——而這次要推翻的是我自己
 * > 「這一定是誤報」的直覺，不是護欄。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { SemanticInterpreter } from '../../../src/interpreter/interpreter'
import { registerCppLanguage } from '../../../src/languages/cpp/generators'
import { hasAnnotation } from '../../../src/core/skip-declarations'
import type { SemanticNode } from '../../../src/core/types'

const n = (
  concept: string,
  properties: Record<string, unknown> = {},
  children: Record<string, SemanticNode[]> = {},
): SemanticNode => ({ concept, properties, children }) as unknown as SemanticNode

const prog = (...body: SemanticNode[]): SemanticNode => n('program', {}, { body })

const say = (t: string): SemanticNode => n('print', {}, { values: [n('string_literal', { value: t })] })

beforeAll(() => {
  registerCppLanguage()
})

async function run(tree: SemanticNode): Promise<string> {
  const interp = new SemanticInterpreter({ maxSteps: 10000 })
  await interp.execute(tree)
  const out = (interp as unknown as { getOutput(): string | string[] }).getOutput()
  return Array.isArray(out) ? out.join('') : out
}

describe('if_else：兩個分支都要能跑', () => {
  it('★ 條件為真 → 走 then', async () => {
    const out = await run(
      prog(n('if_else', {}, { condition: [n('number_literal', { value: 1 })], then: [say('T')], else: [say('F')] })),
    )
    expect(out, 'if_else 沒有執行器——使用者拖得到這個積木、產得出程式碼、跑不了').toContain('T')
    expect(out).not.toContain('F')
  })

  it('★ 條件為假 → 走 else', async () => {
    const out = await run(
      prog(n('if_else', {}, { condition: [n('number_literal', { value: 0 })], then: [say('T')], else: [say('F')] })),
    )
    expect(out).toContain('F')
    expect(out).not.toContain('T')
  })

  it('★ 行為與 `if` 一致——包含它們共有的缺陷', async () => {
    // 原本這支斷言「分支裡的宣告不得外洩」。實測 **`if` 自己也會外洩**——
    // `executeBody` 不建子作用域，而 `introduces_scope` 標註沒有任何東西在讀。
    //
    // 那是一個**既有缺陷**，不是本功能造成的，而修它會改變 `if` 的行為。
    // 這支因此改成釘「兩者一致」：`if_else` 不得比 `if` 更好也不得更差，
    // 否則使用者換一個積木就換一套語義。
    //
    // ⚠️ 哪天作用域修好了，這支會**因為兩者仍然一致而繼續通過**——
    // 所以它不是那個缺陷的釘子。缺陷本身另記。
    const 分支 = (concept: string, thenKey: string): SemanticNode =>
      n('program', {}, {
        body: [
          n('var_declare', { name: 'x', type: 'int' }, { initializer: [n('number_literal', { value: 1 })] }),
          n(concept, {}, { condition: [n('number_literal', { value: 1 })], [thenKey]: [
            n('var_declare', { name: 'x', type: 'int' }, { initializer: [n('number_literal', { value: 9 })] }),
          ] }),
          n('print', {}, { values: [n('var_ref', { name: 'x' })] }),
        ],
      })
    // 比對**結果**，包含丟出來的錯誤——重宣告在兩者都是錯誤，那也算一致
    const 跑 = async (c: string, k: string): Promise<string> => {
      try {
        return 'OUT:' + (await run(分支(c, k)))
      } catch (e) {
        return 'ERR:' + (e as Error).message
      }
    }
    const if結果 = await 跑('if', 'then_body')
    const ifElse結果 = await 跑('if_else', 'then')
    expect(
      ifElse結果,
      `\`if\` → ${if結果}\n\`if_else\` → ${ifElse結果}\n` +
        '同一件事的兩個概念，語義必須一樣',
    ).toBe(if結果)
  })

  it('★ 空的 else 不得炸', async () => {
    const out = await run(
      prog(n('if_else', {}, { condition: [n('number_literal', { value: 0 })], then: [say('T')], else: [] })),
    )
    expect(out).not.toContain('T')
  })
})

describe('if_else 的標註要與 if 一致', () => {
  it('★ 是一個除錯步進點——否則單步執行會跳過整段分支', () => {
    expect(
      hasAnnotation('if_else', 'debug_step'),
      '`if` 有這個標註而 `if_else` 沒有。同一件事的兩個概念，' +
        '使用者換一個積木就換一套除錯行為。',
    ).toBe(true)
  })

  it('★ 引入作用域', () => {
    expect(hasAnnotation('if_else', 'introduces_scope')).toBe(true)
  })
})

/**
 * 分支不建子作用域——一個**既有**缺陷，用會出聲的釘子固定住
 *
 * ## 為什麼用 `it.fails` 而不是 `it.todo`
 *
 * `it.todo` 只有名字，沒有測試本體——缺陷修好了它不會知道，而缺陷帳護欄已經
 * 量出這個專案有 64 筆那種東西，**它們需要的是重新產生測試，不是打勾**。
 *
 * `it.fails` 兩個方向都會說話：
 *
 * | 狀態 | 結果 |
 * |---|---|
 * | 缺陷還在 | **綠**，而且每次跑都把缺陷印在測試名裡 |
 * | 缺陷修好了 | **紅**，提醒把這根釘子拔掉 |
 *
 * 見 `knowledge/skills/build-guardrail`「明確否決的做法」——永久紅的測試會讓
 * 「全套綠」失去意義，而所有護欄的價值都建立在那個訊號上。
 */
describe('[BLOCKED:executeBody] 分支不建子作用域（既有缺陷，066 只是量到它）', () => {
  it.fails('★ 分支裡宣告的變數不應該被外層看見', async () => {
    // `introduces_scope` 標註存在，**而沒有任何東西在讀它**——
    // `executeBody` 只是逐一執行子節點，不建子作用域。
    // 修法是讓 `if` / `if_else` / 迴圈的 body 各自 createChild()，
    // 而那會改變既有行為，需要單獨評估。
    const out = await run(
      prog(
        n('if_else', {}, {
          condition: [n('number_literal', { value: 1 })],
          then: [n('var_declare', { name: '僅限分支內', type: 'int' }, { initializer: [n('number_literal', { value: 9 })] })],
          else: [],
        }),
        n('print', {}, { values: [n('var_ref', { name: '僅限分支內' })] }),
      ),
    )
    // 作用域正確的話，外層讀不到它 → 這裡會丟錯而不是印出 9
    expect(out).not.toContain('9')
  })
})
