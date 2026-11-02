/** `cpp:math_constrain` 的自證測。 */
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
const lift = (c: string): SemanticNode =>
  createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode
const collect = (n: SemanticNode, out: string[] = []): string[] => {
  out.push(n.componentId)
  for (const ks of Object.values(n.slots ?? {})) for (const k of ks) collect(k, out)
  return out
}
// spec 198（重構 6c-1）：執行的判準從 JS 直譯器換成 Cella（`tests/helpers/cella-run.ts`）

describe('cpp:math_constrain', () => {
  it('lift —— 認得出身分', () => {
    const ids = collect(lift('void setup() { int v = constrain(5, 0, 10); }\nvoid loop() {}\n'))
    expect(ids).toContain('cpp:math_constrain')   // ← 正向錨點
    expect(ids).not.toContain('cpp:raw_code')
  })

  it('generate —— 產回原本的呼叫', () => {
    const code = generateCode(lift('void setup() { int v = constrain(5, 0, 10); }\nvoid loop() {}\n'), 'cpp', apcs as StylePreset)
    expect(code).toContain('constrain(5, 0, 10)')
  })

  it('round-trip —— 不漂移', () => {
    const src = 'void setup() {\n  int v = constrain(20, 0, 10);\n}\nvoid loop() {\n}\n'
    const once = generateCode(lift(src), 'cpp', apcs as StylePreset)
    expect(generateCode(lift(once), 'cpp', apcs as StylePreset)).toBe(once)
  })

  // 🟡 釘子：`constrain` 是 Arduino 的巨集，Cella 的套件裡沒有它（arduino 也沒有）——所以這顆刻意【不補】formalize：補了的話 Arduino 程式會從「判不出」變成假的 reject「呼叫未宣告的函式」。等 Cella 的 Arduino 模型有 constrain 再接（已回報）
  it('🟡 已知缺陷（修好時這條會紅）：執行 —— 三種情形（低於、範圍內、高於）', () => knownCellaGap(/math_constrain/, async () => {
    await expectCellaOut(`
      #include <iostream>
      using namespace std;
      int main() {
        cout << constrain(-5, 0, 10) << " " << constrain(5, 0, 10) << " " << constrain(50, 0, 10) << endl;
        return 0;
      }
    `, '0 5 10\n')
  }))

  // 🟡 釘子：同上（Cella 沒有 constrain，formalize 刻意不補）
  it('🟡 已知缺陷（修好時這條會紅）：⚠️ 型別跟著走——小數不得被夾成整數', () => knownCellaGap(/math_constrain/, async () => {
    // 🔴 回傳的是【原本那個值】，不是重新包一個 int
    await expectCellaOut(`
      #include <iostream>
      using namespace std;
      int main() {
        double d = constrain(2.5, 0.0, 10.0);
        cout << d << endl;
        return 0;
      }
    `, '2.5\n')
  }))
})
