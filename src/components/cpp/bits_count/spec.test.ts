/**
 * `cpp:bits_count` 的自證測——每一條負向前面先釘一個正向。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { expectCellaOut, knownCellaGap } from '../../../../tests/helpers/cella-run'
import { generateCode } from '../../../core/projection/code-generator'
import apcs from '../../../languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../../core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

const H = '#include <iostream>\nusing namespace std;\n'
const lift = (c: string): SemanticNode =>
  createTestLifter().lift(parser.parse(H + c)!.rootNode as never) as SemanticNode
const collect = (n: SemanticNode, out: string[] = []): string[] => {
  out.push(n.componentId)
  for (const ks of Object.values(n.slots ?? {})) for (const k of ks) collect(k, out)
  return out
}
// spec 198（重構 6c-1）：執行的判準從 JS 直譯器換成 Cella（`tests/helpers/cella-run.ts`）
const run = (c: string, expected: string) => expectCellaOut(H + c, expected)

describe('膠囊自證：cpp:bits_count', () => {
  it('★ lift：認得，且不落進殘差', () => {
    const ids = collect(lift('int main(){ cout << __builtin_popcount(7); }'))
    expect(ids).toContain('cpp:bits_count')      // ← 正向錨點
    expect(ids).not.toContain('raw_code')
    expect(ids).not.toContain('unresolved')
  })

  it('★ generate：產回原樣', () => {
    const code = generateCode(lift('int main(){ cout << __builtin_popcount(7); }'), 'cpp', apcs as unknown as StylePreset)
    expect(code).toContain('__builtin_popcount(7)')
  })

  // 🟡 不是 Cella 判錯，是 semorphe 這一側缺一段：formalize 回「cpp:bits_count：「__builtin_popcount」是編譯器內建函式，還沒有對應」
  // （`bits_count/formalize.ts` 只翻 `b.count()`）。期望值是 g++ 實測的答案，補上對應之後拿掉 skip。
  it('🟡 已知缺陷（修好時這條會紅）：★ execute：數 1 的個數', () => knownCellaGap(/編譯器內建/, async () => {
    await run('int main(){ cout << __builtin_popcount(7); }', '3')   // 7 = 0b111
    await run('int main(){ cout << __builtin_popcount(0); }', '0')   // 0 沒有 1
    await run('int main(){ cout << __builtin_popcount(8); }', '1')   // 8 = 0b1000
  }))

  // 🟡 不是 Cella 判錯，是 semorphe 這一側缺一段：formalize 回「cpp:bits_count：「__builtin_popcount」是編譯器內建函式，還沒有對應」
  // （`bits_count/formalize.ts` 只翻 `b.count()`）。期望值是 g++ 實測的答案，補上對應之後拿掉 skip。
  it('🟡 已知缺陷（修好時這條會紅）：★ execute：負數以 32 位無號解讀——**帶號位移會讓迴圈不結束**', () => knownCellaGap(/編譯器內建/, async () => {
    await run('int main(){ cout << __builtin_popcount(-1); }', '32')
  }))

  // 🟡 不是 Cella 判錯，是 semorphe 這一側缺一段：formalize 回「cpp:bits_count：「__builtin_popcount」是編譯器內建函式，還沒有對應」
  // （`bits_count/formalize.ts` 只翻 `b.count()`）。期望值是 g++ 實測的答案，補上對應之後拿掉 skip。
  it('🟡 已知缺陷（修好時這條會紅）：★ execute：引數是運算式而不只是常值', () => knownCellaGap(/編譯器內建/, async () => {
    await run('int main(){ int x = 5; cout << __builtin_popcount(x | 2); }', '3')   // 5|2 = 7
  }))
})
