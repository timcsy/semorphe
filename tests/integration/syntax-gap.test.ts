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
import { diagnosticText, diagnosticLayers } from '../../src/core/projection/diagnostic-projection'
import { setMessages } from '../../src/i18n/messages'
import zhTW from '../../src/i18n/zh-TW/blocks.json'

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

/**
 * 🔴 **漏分號的 12 種寫法——學生看到的字**（2026-11-06；使用者同意窗口的提議：「學生常看不出是少了分號」）。
 *
 * 解析器補得出 MISSING「;」的（下一行是宣告、return、`}`、第一行 using）照舊說「這裡少了一個 `;`」；
 * 只有 ERROR 的（下一行是 cout、cin、賦值、呼叫函式、x++ 後接 cout）原本說「這一行的語法不完整」——
 * 現在由 C++ 那側在行尾補 `;` 重新剖析、錯誤消失了才說「這一行的結尾可能少了一個 `;`」，標在**少了分號的那一行**
 * （x++ 那種原本指到下一行）。判準與「不亂猜」見 `languages/cpp/lang/missing-semicolon.ts`。
 */
describe('漏分號：12 種寫法，學生在兩側看到的字', () => {
  const H = '#include <iostream>\nusing namespace std;\nint main() {\n    int x = 1\n'
  // [寫法, 程式, 規則, 第幾行（1 起算）]
  const CASES: [string, string, 'SYNTAX_GAP' | 'SYNTAX_GAP_LIKELY', number][] = [
    ['下一行是宣告', H + '    int y = 2;\n    return 0;\n}\n', 'SYNTAX_GAP', 4],
    ['下一行是 return', H + '    return 0;\n}\n', 'SYNTAX_GAP', 4],
    ['下一行是 }', '#include <iostream>\nusing namespace std;\nint main() {\n    int x = 1\n}\n', 'SYNTAX_GAP', 4],
    ['第一行 using 少分號', '#include <iostream>\nusing namespace std\nint main() {\n    return 0;\n}\n', 'SYNTAX_GAP', 2],
    ['下一行是 cout', H + '    cout << x << endl;\n    return 0;\n}\n', 'SYNTAX_GAP_LIKELY', 4],
    ['下一行是 cin', H + '    cin >> x;\n    return 0;\n}\n', 'SYNTAX_GAP_LIKELY', 4],
    ['下一行是賦值', H + '    x = 2;\n    return 0;\n}\n', 'SYNTAX_GAP_LIKELY', 4],
    ['下一行是呼叫函式', '#include <iostream>\nusing namespace std;\nvoid f(int a) {\n}\nint main() {\n    int x = 1\n    f(x);\n    return 0;\n}\n', 'SYNTAX_GAP_LIKELY', 6],
    ['x++ 後接 cout', '#include <iostream>\nusing namespace std;\nint main() {\n    int x = 1;\n    x++\n    cout << x << endl;\n    return 0;\n}\n', 'SYNTAX_GAP_LIKELY', 5],
    ['cout 少分號、下一行 cout', '#include <iostream>\nusing namespace std;\nint main() {\n    cout << 1 << endl\n    cout << 2 << endl;\n    return 0;\n}\n', 'SYNTAX_GAP_LIKELY', 4],
    ['賦值少分號、下一行宣告', '#include <iostream>\nusing namespace std;\nint main() {\n    int x;\n    x = 3\n    int y = 4;\n    return 0;\n}\n', 'SYNTAX_GAP', 5],
    ['cin 少分號、下一行 cout', '#include <iostream>\nusing namespace std;\nint main() {\n    int x;\n    cin >> x\n    cout << x;\n    return 0;\n}\n', 'SYNTAX_GAP_LIKELY', 5],
  ]
  const TEXT = {
    SYNTAX_GAP: { code: '這裡少了一個 `;`', block: (l: number) => `少了一個 \`;\`（第 ${l} 行）` },
    SYNTAX_GAP_LIKELY: { code: '這一行的結尾可能少了一個 `;`', block: (l: number) => `第 ${l} 行的結尾可能少了一個 \`;\`` },
  }
  beforeAll(() => { setMessages(zhTW as never) })

  it.each(CASES)('★ %s：%s 指在第 %s 行之外不另外報', (_name, src, rule, line) => {
    const ds = diagnose(src).filter((d) => d.source === 'parser')
    expect(ds.map((d) => [d.rule, d.at ? d.at.line + 1 : null])).toEqual([[rule, line]])
    const d = ds[0]
    expect(diagnosticText(d.rule, 'CODE', d.params)).toBe(TEXT[rule].code)
    expect(diagnosticText(d.rule, 'BLOCK', { ...d.params, humanLine: line })).toBe(TEXT[rule].block(line))
    // 點開看得到兩層（為什麼／試試看），而且都提到分號
    expect(diagnosticLayers(d.rule, d.params).join('')).toContain('`;`')
  })

  it('🔴 「可能」只在量得到時才說：補了分號也不會好的錯誤，照舊說「語法不完整」', () => {
    // 與上面「不亂猜」同兩支輸入：認不得的符號、打錯的關鍵字——補了分號也不會好
    for (const src of ['void f() { @@@ ### }', 'void f() { whlie (x < 10) { x++; } }']) {
      const ds = diagnose(src).filter((d) => d.source === 'parser')
      expect(ds.length).toBeGreaterThan(0)
      expect(ds.filter((d) => d.rule === 'SYNTAX_GAP_LIKELY'), src).toEqual([])
    }
  })
})
