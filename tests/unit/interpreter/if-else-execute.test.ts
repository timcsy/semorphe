/**
 * `if_else` 的執行（066）
 *
 * ## 這個缺口是護欄找出來的，而我原本以為它是誤報
 *
 * 完備性護欄長期回報 `if_else.execute` 是 **❌ 缺**——五路裡唯一的一個「缺」。
 * 直覺上那不可能：if/else 是核心控制流程，每個程式都在用。
 *
 * **實測它是真的。** `if_else` 有概念定義、有產生器、有積木投影（`cpp_if_else`，
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
): SemanticNode => ({ conceptId: concept, properties, children }) as unknown as SemanticNode

const prog = (...body: SemanticNode[]): SemanticNode => n('cpp:program', {}, { body })

const say = (t: string): SemanticNode => n('cpp:print', {}, { values: [n('cpp:literal_string', { value: t })] })

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
      prog(n('cpp:if_else', {}, { condition: [n('cpp:literal_number', { value: 1 })], then: [say('T')], else: [say('F')] })),
    )
    expect(out, 'if_else 沒有執行器——使用者拖得到這個積木、產得出程式碼、跑不了').toContain('T')
    expect(out).not.toContain('F')
  })

  it('★ 條件為假 → 走 else', async () => {
    const out = await run(
      prog(n('cpp:if_else', {}, { condition: [n('cpp:literal_number', { value: 0 })], then: [say('T')], else: [say('F')] })),
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
    const branches = (concept: string, thenKey: string): SemanticNode =>
      n('cpp:program', {}, {
        body: [
          n('cpp:var_declare', { name: 'x', type: 'int' }, { initializer: [n('cpp:literal_number', { value: 1 })] }),
          n(concept, {}, { condition: [n('cpp:literal_number', { value: 1 })], [thenKey]: [
            n('cpp:var_declare', { name: 'x', type: 'int' }, { initializer: [n('cpp:literal_number', { value: 9 })] }),
          ] }),
          n('cpp:print', {}, { values: [n('cpp:var_ref', { name: 'x' })] }),
        ],
      })
    // 比對**結果**，包含丟出來的錯誤——重宣告在兩者都是錯誤，那也算一致
    // ⚠️ 這個內層函式原本叫「跑」。改名時它與外層的 `run` 撞在一起，
    // **內層遮蔽外層 → 無限遞迴**，而 `tsc` 完全不報（型別相容）。
    // 那正是 `experience.md` 記過的那一類：**型別檢查看不到的改名錯誤**。
    const runBoth = async (c: string, k: string): Promise<string> => {
      try {
        return 'OUT:' + (await run(branches(c, k)))
      } catch (e) {
        return 'ERR:' + (e as Error).message
      }
    }
    const ifResult = await runBoth('cpp:if', 'then_body')
    const ifElseResult = await runBoth('cpp:if_else', 'then')
    expect(
      ifElseResult,
      `\`if\` → ${ifResult}\n\`if_else\` → ${ifElseResult}\n` +
        '同一件事的兩個概念，語義必須一樣',
    ).toBe(ifResult)
  })

  it('★ 空的 else 不得炸', async () => {
    const out = await run(
      prog(n('cpp:if_else', {}, { condition: [n('cpp:literal_number', { value: 0 })], then: [say('T')], else: [] })),
    )
    expect(out).not.toContain('T')
  })
})

describe('if_else 的標註要與 if 一致', () => {
  it('★ 是一個除錯步進點——否則單步執行會跳過整段分支', () => {
    expect(
      hasAnnotation('cpp:if_else', 'debug_step'),
      '`if` 有這個標註而 `if_else` 沒有。同一件事的兩個概念，' +
        '使用者換一個積木就換一套除錯行為。',
    ).toBe(true)
  })

  it('★ 引入作用域', () => {
    expect(hasAnnotation('cpp:if_else', 'introduces_scope')).toBe(true)
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
describe('分支自成作用域——標註終於被讀了（067 修好，釘子已拔）', () => {
  /**
   * ## 這裡原本是一根 `it.fails` 的釘子
   *
   * 066 量到分支裡宣告的變數會外洩，但沒修——理由是「修它會改變 `if` 的
   * 既有行為」。釘子的形式是 `it.fails`：缺陷還在＝綠且出聲，修好了＝紅且
   * 提醒拔釘子。**它照設計變紅了，所以釘子拔掉，斷言換成正確的行為。**
   *
   * ## 修法不是再寫死一份清單
   *
   * `introduces_scope` 這個標註**一直都在，而沒有任何東西讀它**——
   * `concepts/執行機構.md` 的「機制有了，沒人接上」。寫死「if 和 if_else 要
   * 建子作用域」也能修，但那會是這個階段的**第三份**寫死清單。
   *
   * 核心讀宣告，語言套件推宣告——與 skip、executor、註解語法同一個形狀。
   */
  it('★ 分支裡宣告的變數，外層讀不到', async () => {
    // ⚠️ 同上：這個內層函式原本叫「跑」，改名後遮蔽外層的 `run` → 無限遞迴。
    const runOnce = async (): Promise<string> => {
      try {
        return 'OUT:' + (await run(
          prog(
            n('cpp:if_else', {}, {
              condition: [n('cpp:literal_number', { value: 1 })],
              then: [n('cpp:var_declare', { name: '僅限分支內', type: 'int' }, { initializer: [n('cpp:literal_number', { value: 9 })] })],
              else: [],
            }),
            n('cpp:print', {}, { values: [n('cpp:var_ref', { name: '僅限分支內' })] }),
          ),
        ))
      } catch (e) {
        return 'ERR:' + (e as Error).message
      }
    }
    const r = await runOnce()
    expect(r, '外層讀得到分支內的變數 → 作用域沒有隔開').toContain('UNDECLARED_VAR')
  })

  it('★ 但外層的變數在分支裡讀得到——隔的是往外，不是往內', async () => {
    const out = await run(
      prog(
        n('cpp:var_declare', { name: '外層', type: 'int' }, { initializer: [n('cpp:literal_number', { value: 7 })] }),
        n('cpp:if_else', {}, {
          condition: [n('cpp:literal_number', { value: 1 })],
          then: [n('cpp:print', {}, { values: [n('cpp:var_ref', { name: '外層' })] })],
          else: [],
        }),
      ),
    )
    expect(out, '子作用域讀不到父層 → 建錯了，那不是巢狀是隔離').toContain('7')
  })

  it('★ 分支裡的指派要影響外層的變數——那不是宣告', async () => {
    const out = await run(
      prog(
        n('cpp:var_declare', { name: 'x', type: 'int' }, { initializer: [n('cpp:literal_number', { value: 1 })] }),
        n('cpp:if_else', {}, {
          condition: [n('cpp:literal_number', { value: 1 })],
          then: [n('cpp:var_assign', { obj: 'x' }, { value: [n('cpp:literal_number', { value: 5 })] })],
          else: [],
        }),
        n('cpp:print', {}, { values: [n('cpp:var_ref', { name: 'x' })] }),
      ),
    )
    expect(out, '分支裡改外層變數改不到 → 子作用域把指派也攔下來了').toContain('5')
  })
})
