/**
 * `std::cout` 與 `cout` 是**同一個實體** —— 而它一直不是。
 *
 * ## 這支測試從哪來
 *
 * 2026-08-17，spec 139 新增了一個測試檔，裡面的 fixture 寫著
 * `std::cout << x + y;`。第三十一條護欄（形態的殘差）立刻紅了：
 *
 * ```
 * 殘差率(%): 0 → 0.02      unresolved: "std::cout"  ＋  raw_code: "std"
 * ```
 *
 * ⚠️ **而那不是新的缺陷** ——`cpp_cout_chain` 的 `rootMatch.text` 一直是
 * 精確比對 `"cout"`。只是既有語料幾乎都寫 `using namespace std;`，
 * 所以它**從來沒有現形**。
 *
 * > **一個缺口如果只在「大家都不那樣寫」的地方，
 * > 它會一直在，而且沒有人會發現。**
 *
 * 🟢 而護欄做對了它該做的事：**一段新的真實程式碼進來，數字就動了。**
 * ⚠️ 處置是**修**（改鏈的根比對），不是調基線、也不是把 fixture 換成
 * 不會踩到的寫法——**後兩者都是把尺改短**。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import type { SemanticNode } from '../../src/core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
}, 30000)

const conceptsIn = (code: string): string[] => {
  const t = createTestLifter().lift(parser.parse(code)!.rootNode as never) as SemanticNode
  const ids: string[] = []
  const walk = (n: SemanticNode): void => {
    ids.push(n.componentId)
    for (const ks of Object.values(n.children ?? {})) for (const k of ks) walk(k)
  }
  if (t) walk(t)
  return ids
}

describe('限定名稱的串流輸出', () => {
  it('正向錨點：不限定的形式本來就好的', () => {
    const ids = conceptsIn('int main(){ cout << 1; }')
    expect(ids).toContain('cpp:print')
    expect(ids).not.toContain('raw_code')
  })

  it('🔴 `std::cout` 要與 `cout` 認成同一顆概念', () => {
    const ids = conceptsIn('int main(){ std::cout << 1; }')
    expect(ids, '限定名稱的串流輸出必須是 cpp:print').toContain('cpp:print')
    expect(ids).not.toContain('raw_code')
    expect(ids).not.toContain('unresolved')
  })

  it('🔴 鏈上有多個值時也一樣', () => {
    const ids = conceptsIn('int main(){ int x=1; std::cout << x << "hi" << 2; }')
    expect(ids).toContain('cpp:print')
    expect(ids).not.toContain('unresolved')
  })

  it('⚠️ 而它不得過度匹配——`mycout` 不是 `cout`', () => {
    // 比對的是「最後一段」，所以 `foo::cout` 算、`mycout` 不算。
    const ids = conceptsIn('int main(){ int mycout=0; mycout << 1; }')
    expect(ids).not.toContain('cpp:print')
  })
})
