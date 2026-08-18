/** `cpp:math_constrain` 的自證測。 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { SemanticInterpreter } from '../../../interpreter/interpreter'
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
  out.push(n.conceptId)
  for (const ks of Object.values(n.children ?? {})) for (const k of ks) collect(k, out)
  return out
}
const run = async (c: string): Promise<string> => {
  const i = new SemanticInterpreter({ maxSteps: 100_000 })
  await i.execute(lift(c))
  return i.getOutput().join('')
}

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

  it('執行 —— 三種情形（低於、範圍內、高於）', async () => {
    const out = await run(`
      #include <iostream>
      using namespace std;
      int main() {
        cout << constrain(-5, 0, 10) << " " << constrain(5, 0, 10) << " " << constrain(50, 0, 10) << endl;
        return 0;
      }
    `)
    expect(out.trim()).toBe('0 5 10')
  })

  it('⚠️ 型別跟著走——小數不得被夾成整數', async () => {
    const out = await run(`
      #include <iostream>
      using namespace std;
      int main() {
        double d = constrain(2.5, 0.0, 10.0);
        cout << d << endl;
        return 0;
      }
    `)
    // 🔴 回傳的是【原本那個值】，不是重新包一個 int
    expect(out.trim()).toBe('2.5')
  })
})
