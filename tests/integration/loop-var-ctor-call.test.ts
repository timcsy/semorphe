/**
 * **迴圈變數當建構引數：`T t(k);` 是一個物件，不是函式宣告**（spec 208 T002 抓到）。
 *
 * 判準早就有（`strategies.ts` 的 `looksLikeCtorCall`：括號裡的名字是宣告過的變數 ⟹ 建構）。而計數迴圈的變數從來沒被記進
 * lift 的查找表——`loop_count` 的名字放在 `var_name`，`recordDeclaration` 只認 `name`，而且本體是在建迴圈節點之前就 lift 的。
 * 於是迴圈裡的 `T t(k);` 被 lift 成「回傳 T、參數型別叫 k」的前置宣告：Cella 照實跑出一個什麼都沒做的迴圈。
 * 直譯器時代沒有人發現，因為它對前置宣告也什麼都不做——兩邊恰好一樣「安靜」。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { createTestLifter } from '../helpers/setup-lifter'
import type { SemanticNode } from '../../src/core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})
const ids = (code: string): string[] => {
  const out: string[] = []
  const walk = (n: SemanticNode): void => { out.push(n.componentId); for (const k of Object.values(n.slots ?? {})) k.forEach(walk) }
  walk(createTestLifter().lift(parser.parse(code)!.rootNode as never) as SemanticNode)
  return out
}
const S = 'struct T { int i; T(int x) : i(x) {} };\n'

describe('迴圈變數當建構引數', () => {
  it('★ 正向錨點：函式裡的一般變數當引數 → 物件（這條判準本來就對）', () => {
    expect(ids(`${S}int main() { int k = 1; T t(k); return 0; }`)).not.toContain('cpp:forward_decl')
  })
  it('🔴 計數迴圈的變數當引數 → 物件，不是前置宣告', () => {
    expect(ids(`${S}int main() { for (int k = 1; k <= 3; k++) { T t(k); } return 0; }`)).not.toContain('cpp:forward_decl')
  })
  it('★ 反向：真的前置宣告照舊（括號裡是型別）', () => {
    expect(ids(`${S}int main() { T f(int); return 0; }`)).toContain('cpp:forward_decl')
  })
  it('★ 迴圈變數不得漏到迴圈外：迴圈後面的 `T g(k);`（k 已不在作用域）照舊是前置宣告', () => {
    const t = ids(`${S}int main() { for (int k = 1; k <= 3; k++) {} T g(k); return 0; }`)
    expect(t).toContain('cpp:forward_decl')
  })
})
