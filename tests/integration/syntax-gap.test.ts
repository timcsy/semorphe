/**
 * spec 143：語法錯誤說得出**少了什麼、在哪裡**。
 *
 * ## 🔴 反向測試寫在正向【前面】，而那不是形式
 *
 * 這一刀最可能的失敗是**開始亂報**——每一個 `hasError` 的節點都掛一個提示。
 * 而 `experience.md` 逐字：
 *
 * > **一個指錯地方的錯誤訊息，比沒有訊息更糟。**
 *
 * 所以反向那三支先在「還沒有提示」的世界裡釘住零診斷／零提示。
 *
 * ⚠️ **它們第一次跑是綠的**——同 `build-guardrail` 6.5 的例外條款
 * （「靠注入不靠第一次的紅」）。正向那幾支就是它們的注入：實作之前必須紅。
 *
 * ## ⚠️ 自我否證聲明
 *
 * **如果「正確的程式」那一支在 lift 回 `null` 的時候也通過，它證明的是
 * 「什麼都沒跑」，不是「沒有診斷」。** 所以每一條反向前面都有一個正向錨點。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import type { Lifter } from '../../src/core/lift/lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { diagnosticsFromTree } from '../../src/core/diagnostics'
import type { SemanticNode } from '../../src/core/types'

let tsParser: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
})

function lift(src: string): SemanticNode | null {
  return lifter.lift(tsParser.parse(src).rootNode as never)
}

function diagnose(src: string) {
  const t = lift(src)
  expect(t, 'lift 回了 null → 下面每一條都空過').not.toBeNull()
  return diagnosticsFromTree(t!)
}

/** 一則診斷帶不帶修復提示。 */
function hasHint(d: { params: Record<string, string | number> }): boolean {
  return d.params.missing !== undefined
}

describe('spec 143 · US2：🔴 不亂報、不亂猜', () => {
  it('★ 錨點：一段有語法錯誤的程式【確實】產得出診斷', () => {
    // 沒有這一條的話，下面「零診斷」可能只是因為診斷從來不產出
    expect(diagnose('void f() {\n  int x = 1\n  int y = 2;\n}').length,
      '有錯的程式一則診斷都沒有 → 下面每一條反向都空過').toBeGreaterThan(0)
  })

  it('🔴 一段正確的程式 → 語法診斷【0】個', () => {
    const d = diagnose('void f() {\n  int x = 1;\n  int y = 2;\n}\n')
    expect(d, `正確的程式被報了 ${d.length} 則語法診斷`).toEqual([])
  })

  it('🔴 認不得的輸入 → 有診斷，而修復提示【0】個', () => {
    const d = diagnose('void f() { @@@ ### }')
    expect(d.length, '認不得的輸入應該仍然說「語法不完整」').toBeGreaterThan(0)
    expect(d.filter(hasHint), '對認不得的東西編出了修復提示——那是猜的').toEqual([])
  })

  it('🔴 打錯的關鍵字 → 不得指向任何候選', () => {
    // ⚠️ `whlie` 是一個**合法的識別字**，tree-sitter 把它當運算式開頭
    //    ——那個 token 我們拿不到，說「你是不是要打 while」就是猜的。
    //    重開這件事的條件寫在 spec.md 的「明確排除」。
    const d = diagnose('void f() { whlie (x < 10) { x++; } }')
    const text = JSON.stringify(d)
    expect(text.includes('while'), '出現了指向 while 的建議 → 那是猜的').toBe(false)
  })
})

describe('spec 143 · US1：說得出少了什麼、在哪裡', () => {
  /** 一則診斷的缺口描述——⚠️ 0-based，與 `startPosition` 一致。 */
  function gaps(src: string): { missing: unknown; line: unknown; column: unknown }[] {
    return diagnose(src)
      .filter((d) => d.params.missing !== undefined)
      .map((d) => ({ missing: d.params.missing, line: d.at?.line, column: d.at?.column }))
  }

  // ⚠️ **四種形狀逐條斷言，不從一個推論其他**
  //    （`experience.md`「一叢違規不一定同一個根因」）。
  it('形狀一：宣告少分號', () => {
    expect(gaps('void f() {\n  int x = 1\n  int y = 2;\n}'))
      .toContainEqual({ missing: ';', line: 1, column: 11 })
  })

  it('形狀二：輸出少分號', () => {
    expect(gaps('void f() {\n  cout << "hi"\n}'))
      .toContainEqual({ missing: ';', line: 2, column: 1 })
  })

  it('形狀三：巢狀區塊——位置要在【最內層】那一行', () => {
    const g = gaps('void f() {\n  if (x > 1) {\n    y = 2\n  }\n}')
    expect(g).toContainEqual({ missing: ';', line: 2, column: 9 })
    // 🔴 而它不得同時指在 `if` 或函式那一行——那會讓學生去看沒問題的地方
    expect(g.filter((x) => x.line === 1 || x.line === 0)).toEqual([])
  })

  it('形狀四：for 的第一個分號', () => {
    expect(gaps('void f() {\n  for (int i=0 i<3; i++) {}\n}'))
      .toContainEqual({ missing: ';', line: 1, column: 14 })
  })

  it('🔴 缺的不是分號時，要說出【是哪一個符號】', () => {
    // ⚠️ 不預先列舉符號種類——直接用解析器給的節點型別
    //    （`experience.md`「列舉已知的，等於保證下一個會被漏掉」）。
    const all = gaps('void f() {\n  int x = 1\n}').map((g) => g.missing)
    expect(all.every((m) => typeof m === 'string' && m.length > 0),
      '缺口沒有說出缺的是什麼').toBe(true)
  })
})
