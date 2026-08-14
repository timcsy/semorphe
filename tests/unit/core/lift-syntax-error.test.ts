/**
 * **語法錯誤要在樹上出聲。**
 *
 * ## 這一支釘住的缺陷
 *
 * 2026-08-14 實測：`int x = @@@;` 被 lift 成一顆**乾淨的 `cpp:var_declare`，
 * 信心 `high`**——那個 `@@@` 整個消失，而且沒有任何訊號。
 *
 * ```
 * declaration [hasError]
 *   primitive_type / identifier
 *   ERROR ⟪= @@@⟫        ← lift 只走它認得的子節點，沒有人看它
 * ```
 *
 * > **一段語法錯誤的程式碼被 lift 成一棵看起來完全健康的樹
 * > ——那正是這個專案追了一整年的靜默降級，發生在辨識的入口。**
 *
 * ⚠️ 而它讓殘差護欄的 `ratePercent: 0` 讀起來像「模型長全了」，
 * 而真相有一部分是「壞掉的那段被丟了」。
 *
 * ## ⚠️ 這支放在 `tests/unit/`，不是 `integration/`
 *
 * `audit-behavior-error` 的 `fetchCorpus()` 掃 **`tests/integration/*.test.ts`
 * 的樣板字面**當語料。把故意寫壞的程式碼放進去，會讓那條護欄拿它去跟
 * 參照編譯器對答案——**而它本來就編不過**。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../helpers/setup-lifter'
import { registerCppLanguage } from '../../../src/languages/cpp/generators'
import type { SemanticNode } from '../../../src/core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

const H = '#include <iostream>\nusing namespace std;\n'
const lift = (body: string): SemanticNode =>
  createTestLifter().lift(parser.parse(H + body)!.rootNode as never) as SemanticNode

/** 樹上所有被標為語法錯誤的節點 */
function broken(n: SemanticNode, out: { id: string; raw: string }[] = []): { id: string; raw: string }[] {
  if (n.metadata?.degradationCause === 'syntax_error') {
    out.push({ id: n.conceptId, raw: String(n.metadata?.rawCode ?? '') })
  }
  for (const bucket of Object.values(n.children ?? {})) for (const c of bucket ?? []) broken(c, out)
  return out
}

describe('語法錯誤要在樹上出聲', () => {
  it('★ 正確的程式一個標記都沒有（正向錨點——先證明量得到「乾淨」）', () => {
    expect(broken(lift('int main(){ int x = 1; cout << x; return 0; }'))).toEqual([])
  })

  it('★ 少一個分號——第一週最常撞的那個', () => {
    const hits = broken(lift('int main(){ int x = 1\n  cout << x;\n  return 0; }'))
    expect(hits, '語法壞了而樹上一聲不吭').toHaveLength(1)
    expect(hits[0].id, '標在宣告那一顆上').toBe('cpp:var_declare')
  })

  /**
   * 🔴 **解析器有兩種標記錯誤的方式，而我們曾經只認得一種。**
   *
   * ```
   * A  int x = 1 ⏎ return 0;    declaration [hasError]，【沒有 ERROR 節點】
   * B  int x = 1 ⏎ cout << x;   declaration → init_declarator → ERROR ⟪1⟫
   * C  int x = 1 ⏎ int y = 2;   同 A
   * ```
   *
   * ⚠️ **而 A、C 是更常見的形狀**——在兩行之間漏掉分號，下一行是另一個語句。
   * 只認得 B 的話，「下一行是什麼」決定了會不會被抓到——**而那對學生毫無意義**。
   */
  it('🔴 ★ A：少分號而下一行是 return', () => {
    const hits = broken(lift('int main(){ int x = 1\n  return 0; }'))
    expect(hits, '這種形狀沒有 ERROR 節點，只有傳播旗標——漏掉它等於漏掉最常見的一半').toHaveLength(1)
    expect(hits[0].id).toBe('cpp:var_declare')
  })

  it('🔴 ★ C：少分號而下一行是另一個宣告', () => {
    const hits = broken(lift('int main(){ int x = 1\n  int y = 2;\n  return 0; }'))
    expect(hits).toHaveLength(1)
    expect(hits[0].id).toBe('cpp:var_declare')
  })

  it('🔴 ★ 落點不得往上飄——`cpp:program` 不准被標記', () => {
    // ⚠️ 傳播旗標會一路傳到最外層。判定變寬之後，
    // **落點邏輯是唯一擋住「整棵樹被標記」的東西**。
    for (const src of [
      'int main(){ int x = 1\n  return 0; }',
      'int main(){ int x = 1\n  cout << x;\n  return 0; }',
      'int main(){ int x = 1\n  int y = 2;\n  return 0; }',
    ]) {
      const hits = broken(lift(src))
      expect(hits.map((h) => h.id), '標記飄到整個程式上 → 「哪裡壞了」變成「整棵樹壞了」').not.toContain('cpp:program')
      expect(hits, '一個錯誤標了不只一處 → 落點邏輯失效').toHaveLength(1)
    }
  })

  it('🔴 ★ 原文要是完整的一行，不是解析器切出來的片段', () => {
    // 積木上顯示「照抄原文的：1」——技術正確而教學上沒用。
    const hits = broken(lift('int main(){ int x = 1\n  cout << x;\n  return 0; }'))
    expect(hits[0].raw, '只抄到 ERROR 片段 → 學生看到「照抄原文的：1」').toContain('int x = 1')
  })

  it('★ 認不得的符號', () => {
    const hits = broken(lift('int main(){ int x = @@@; return 0; }'))
    expect(hits).toHaveLength(1)
    expect(hits[0].raw, '壞掉的原文要留下來——投影靠它告訴使用者是哪裡').toContain('@@@')
  })

  it('★ 只標最內層那一顆，不標祖先', () => {
    // 🔴 第一版把 `claimed` 只查直接子節點，於是 `cpp:program` 也被標上
    // ——而那讓「哪裡壞了」又變回「整棵樹壞了」，正好抵消這個標記的用處。
    const hits = broken(lift('int main(){ int x = 1\n  cout << x;\n  return 0; }'))
    expect(hits.map((h) => h.id), 'program／func_def 不該被標').toEqual(['cpp:var_declare'])
  })

  /**
   * ✅ **這一格 2026-08-14 被關掉了（spec `121`），而它是【順帶】關掉的。**
   *
   * 原本的註解逐字：「tree-sitter 對『少一個 `}`』補的是 **MISSING** 節點
   * 而不是 ERROR，而這個判準只看 ERROR。**寫下來而不是假裝有覆蓋**
   * ——一個沒被記下的能力邊界，下次會被當成迴歸去查。」
   *
   * 而 `121` 補的是**傳播旗標**（為了另外兩種漏分號的形狀），
   * **MISSING 節點也帶那個旗標**——於是這一格一起關了。
   *
   * > **一個被記下來的能力邊界，會在根因被修掉的那天自己舉手。**
   * > 那正是那支釘子存在的理由——它紅了，而紅得是對的。
   */
  it('✅ 少一個右大括號——2026-08-14 起標得出來了', () => {
    const hits = broken(lift('int main(){ int x = 1;\n  if (x > 0) {\n    cout << x;\n  return 0; }'))
    expect(hits, '這一格 121 關掉了——若又變空，代表旗標判定被改回去了').toHaveLength(1)
    // ⚠️ 落在 `func_def` 而不是 `if`：少的那個 `}` 讓整個函式的結構不完整，
    // 而**最深的已 lift 節點就是函式本身**。那是對的落點，不是往上飄。
    expect(hits[0].id).toBe('cpp:func_def')
  })
})
