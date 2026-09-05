/**
 * 探針：**那五個「該補進語料」的語法形狀，今天到底怎麼樣？**
 *
 * 🔴 它回答的是 vision「未清的債」裡那一句**擋著動工的問句**：
 *
 * > ⚠️ **補之前先答一句**：這五個裡有幾個是「這個工具本來就不做」？
 * > 現在全部歸在保守桶，**因為沒有人驗過它們的支援度**——先驗，再決定
 * > 是補語料還是改判定。
 *
 * 這一支就是那個「先驗」。它**不判對錯**——它只把三件事量出來：
 *
 * ```
 * ① 解析得出來嗎        tree-sitter 認不認得這個形狀
 * ② lift 之後res了嗎     有沒有掉進 raw_code／unsupported
 * ③ 來回一趟一樣嗎      lift → generate 的輸出與原文
 * ```
 *
 * ⚠️ **量出來的東西不會自己變成決定**——「補語料」還是「本來就不做」
 * 是一個關於**產品範圍**的判斷，而它要人拍板。這一支只讓那個判斷有東西可以看。
 *
 * > **一個「先驗再決定」的步驟，如果它generated的是一個結論，那它就跳過了決定。
 * > 它該generated的是【一張表】。**
 */
import { describe, it, beforeAll, expect } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

/** 五個形狀各一段**最小**的 C++——⚠️ 最小是重點：多一行就分不出是誰讓它res的。 */
const SHAPES: Record<string, string> = {
  // `void f(int[10])`——參數裡沒有名字的陣列
  abstract_array_declarator: 'void f(int[10]) {\n}\n',
  // 🔴 **`literal_suffix` 不是「數字後綴」**——`5LL` 一個都不產生（實測，見上一支）。
  //    它只出現在**自訂字面**裡：`42.0_km` 的 `_km`。
  //    ⚠️ 那表示它與 `user_defined_literal` **是同一件事的兩個節點**，
  //    不是兩個獨立的形狀——而那條債把它們數成兩筆。
  literal_suffix: 'int main() {\n    auto d = 42.0_km;\n    return 0;\n}\n',
  // 🔴 `int (x)` 與 `int (*p)[10]` **都不產生它**（實測）——只有**函式指標**會。
  parenthesized_declarator: 'int main() {\n    void (*f)(int);\n    return 0;\n}\n',
  // `auto [a, b] = t;`——C++17 的結構化繫結
  structured_binding_declarator: '#include <utility>\nint main() {\n    std::pair<int, int> t{1, 2};\n    auto [a, b] = t;\n    return 0;\n}\n',
  // `42_km`——自訂字面
  user_defined_literal: 'long double operator"" _km(long double v) { return v; }\nint main() {\n    auto d = 42.0_km;\n    return 0;\n}\n',
}

const walk = (n: SemanticNode, out: SemanticNode[] = []): SemanticNode[] => {
  out.push(n)
  for (const ks of Object.values(n.children ?? {})) for (const k of ks ?? []) walk(k, out)
  return out
}

interface Row {
  shape: string
  shapeFound: boolean
  hasSyntaxError: boolean
  residuals: string[]
  roundTripsExact: boolean
  generated: string
}

function measure(shape: string, code: string): Row {
  const tree = parser.parse(code)
  const root = tree!.rootNode
  // ① 這個形狀真的出現在語法樹上了嗎——⚠️ 沒出現的話這一列量的是別的東西
  let found = false
  let hasError = false
  const visit = (n: { type: string; children: unknown[] }): void => {
    if (n.type === shape) found = true
    if (n.type === 'ERROR') hasError = true
    for (const c of n.children as { type: string; children: unknown[] }[]) if (c) visit(c)
  }
  visit(root as never)

  const lifted = createTestLifter().lift(root as never) as SemanticNode | null
  const res = lifted === null ? ['(lift 回傳 null)'] : walk(lifted)
    .filter((n) => n.metadata?.degradationCause !== undefined)
    .map((n) => `${n.componentId}:${String(n.metadata?.degradationCause)}`)
  const out = lifted === null ? '' : generateCode(lifted, 'cpp', apcs as StylePreset)
  const norm = (s: string): string => s.replace(/\s+/g, ' ').trim()
  return { shape, shapeFound: found, hasSyntaxError: hasError, residuals: [...new Set(res)],
    roundTripsExact: norm(out) === norm(code), generated: out }
}

describe('探針：五個「該補進語料」的形狀', () => {
  it('★ 入口條件——解析器真的載起來了', () => {
    expect(parser.parse('int main() { return 0; }')!.rootNode.type).toBe('translation_unit')
  })

  /**
   * ⚠️ **先找出「什麼寫法會產生這個節點」**——而這一支本身就是一個答案：
   * 一個**寫不出來的節點型別**，是「這個工具不做」最強的一種證據
   * （不是我們不做，是**沒有人寫得出來**）。
   */
  it('候選寫法 × 節點型別', () => {
    const has = (code: string, want: string): boolean => {
      let f = false
      const visit = (n: { type: string; children: unknown[] }): void => {
        if (n.type === want) f = true
        for (const c of n.children as { type: string; children: unknown[] }[]) if (c) visit(c)
      }
      visit(parser.parse(code)!.rootNode as never)
      return f
    }
    const cands: [string, string][] = [
      ['literal_suffix', 'auto d = 42.0_km;'],
      ['literal_suffix', 'long long x = 5LL;'],
      ['literal_suffix', 'auto s = "hi"_x;'],
      ['user_defined_literal', 'auto d = 42.0_km;'],
      ['parenthesized_declarator', 'int (x) = 5;'],
      ['parenthesized_declarator', 'void (*f)(int);'],
      ['parenthesized_declarator', 'int (*p)[10];'],
      ['abstract_array_declarator', 'void f(int[10]);'],
      ['abstract_array_declarator', 'using T = int[10];'],
      ['structured_binding_declarator', 'auto [a, b] = t;'],
    ]
    // eslint-disable-next-line no-console
    console.log('\n' + cands.map(([w, c]) =>
      `${w.padEnd(30)} ${has(c, w) ? '✅' : '🔴'}  ${JSON.stringify(c)}`).join('\n') + '\n')
    expect(cands.length).toBeGreaterThan(0)
  })

  it('把三件事量出來（⚠️ 不判對錯——決定要人做）', () => {
    const rows = Object.entries(SHAPES).map(([s, c]) => measure(s, c))
    const w = Math.max(...rows.map((r) => r.shape.length))
    // eslint-disable-next-line no-console
    console.log('\n' + rows.map((r) =>
      `${r.shape.padEnd(w)}  解析=${r.shapeFound ? '✅' : '🔴'}` +
      ` 語法錯=${r.hasSyntaxError ? '🔴' : '✅'}` +
      ` 來回=${r.roundTripsExact ? '✅' : '🔴'}` +
      ` 殘=${r.residuals.length === 0 ? '（無）' : r.residuals.join(' ')}`,
    ).join('\n') + '\n')
    for (const r of rows.filter((x) => !x.roundTripsExact)) {
      // eslint-disable-next-line no-console
      console.log(`── ${r.shape} 的generated ──\n${r.generated}`)
    }

    // 🔴 **唯一的斷言：每一個形狀都真的出現在語法樹上。**
    //    ⚠️ 沒出現的話這一列量的是「我寫錯了範例」，不是「這個形狀怎麼樣」
    //    ——而那兩者在報表上長得一模一樣。
    expect(
      rows.filter((r) => !r.shapeFound).map((r) => r.shape),
      '🔴 這幾段範例沒有產生它要示範的那個節點——先修範例，這份報表才算數',
    ).toEqual([])
  })

  /**
   * 🔴 **silentLoss：來回不一致，而【沒有任何一顆節點說它降級了】。**
   *
   * 那比「不支援」更糟——不支援會留下 `raw_code`，使用者看得到一塊原樣保留的碼；
   * 而silentLoss是**程式碼被改掉了而沒有人說**。
   *
   * ```
   * void f(int[10])   →  void f(int)        陣列大小沒了
   * void (*f)(int);   →  void f(int);       函式指標【變成函式宣告】
   * ```
   *
   * ⚠️ 第二個不只是掉資訊，是**改變意義**：一個變數變成了一個宣告。
   *
   * > **一個誠實的「我不會」，比一個安靜的「我改了你的程式」好。**
   *
   * 🟢 而 `literal_suffix`／`user_defined_literal` 走的正是誠實那條路
   * （`raw_code: nonstandard_but_valid`，來回逐字相同）——**它們不是債**。
   *
   * ## ⚠️ 這一條是棘輪，不是硬性零
   *
   * 修這三個各自是一刀（`param_decl` 的解析）。現在把數字釘住：
   * **只准下降**。而它降到 0 的那天，這一條要改成硬性零。
   */
  it('棘輪：silentLoss的形狀只准下降', () => {
    const silentLoss = Object.entries(SHAPES).map(([s, c]) => measure(s, c))
      .filter((r) => !r.roundTripsExact && r.residuals.length === 0)
      .map((r) => r.shape)
    expect(
      silentLoss.length,
      `🔴 silentLoss變多了：${silentLoss.join('、')}\n` +
        '   「來回不一致」＋「沒有任何節點說它降級了」＝ 程式碼被改掉而沒有人說。\n' +
        '   ⚠️ 修法不是把它加進這個數字，是讓它【出聲】（raw_code）或【做對】。',
    ).toBeLessThanOrEqual(3)
    // ★ 自我否證：三個都修好的那天這一條會紅，而那時要把它改成硬性零
    expect(
      silentLoss.length,
      '🟢 silentLoss降到 0 了——把這條改成硬性零（`toEqual([])`），別讓它停在 3',
    ).toBeGreaterThan(0)
  })
})
