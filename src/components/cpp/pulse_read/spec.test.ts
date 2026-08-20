/**
 * `cpp:pulse_read`（超音波）的自證測。
 *
 * ## 🔴 執行那一路驗的是「回 0」，而測試要說明**為什麼那不是缺陷**
 *
 * 真的 `pulseIn` 在逾時之前沒等到脈衝就回 0——所以模擬回 0
 * ＝「這根腳位上沒有回音」，**與真板子在沒接東西時的行為一致**。
 *
 * > **一個看起來像「還沒實作」的回傳值，如果它同時是真實行為，
 * > 那就要有一條測試把「它是對的」寫下來——否則下一個人會去補一個假的讀數。**
 */
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
  out.push(n.componentId)
  for (const ks of Object.values(n.children ?? {})) for (const k of ks) collect(k, out)
  return out
}
const run = async (c: string): Promise<string> => {
  const i = new SemanticInterpreter({ maxSteps: 100_000 })
  await i.execute(lift(c))
  return i.getOutput().join('')
}

describe('cpp:pulse_read', () => {
  it('lift —— 認得出身分（而 pulseIn 不叫 pulse_in）', () => {
    const ids = collect(lift('void setup() { long d = pulseIn(7, HIGH); }\nvoid loop() {}\n'))
    expect(ids).toContain('cpp:pulse_read')     // ← 正向錨點
    expect(ids).not.toContain('cpp:raw_code')
  })

  it('generate —— 兩引數與三引數各自產回原樣', () => {
    const two = generateCode(lift('void setup() { long d = pulseIn(7, HIGH); }\nvoid loop() {}\n'), 'cpp', apcs as StylePreset)
    expect(two).toContain('pulseIn(7, HIGH)')
    // 🔴 沒有逾時時不得產出空的逗號
    expect(two).not.toContain('pulseIn(7, HIGH,)')

    const three = generateCode(lift('void setup() { long d = pulseIn(7, HIGH, 30000); }\nvoid loop() {}\n'), 'cpp', apcs as StylePreset)
    expect(three).toContain('pulseIn(7, HIGH, 30000)')
  })

  it('round-trip —— 不漂移', () => {
    const src = 'void setup() {\n  long a = pulseIn(7, HIGH);\n  long b = pulseIn(7, LOW, 30000);\n}\nvoid loop() {\n}\n'
    const once = generateCode(lift(src), 'cpp', apcs as StylePreset)
    expect(generateCode(lift(once), 'cpp', apcs as StylePreset)).toBe(once)
  })

  it('🔴 執行 —— 沒接東西回 0，而那與真板子的逾時行為一致（不是靜默降級）', async () => {
    const out = await run(`
      #include <iostream>
      using namespace std;
      int main() {
        long d = pulseIn(7, HIGH);
        cout << d << endl;
        return 0;
      }
    `)
    expect(out.trim()).toBe('0')
  })

  it('🔴 它是【運算式】——回傳值進得了算術，不會炸', async () => {
    // ⚠️ 這一條就是「為什麼不能 skipPaths」的執行機構：
    //    安靜 return undefined 的話，這裡的乘法會把 undefined 餵給 toNumber。
    const out = await run(`
      #include <iostream>
      using namespace std;
      int main() {
        long cm = pulseIn(7, HIGH) * 0.034 / 2;
        cout << cm << endl;
        return 0;
      }
    `)
    expect(out.trim()).toBe('0')
  })

  it('⚠️ 腳位超出範圍要出聲，不是安靜回 0', async () => {
    await expect(run('int main() { long d = pulseIn(99, HIGH); return 0; }')).rejects.toThrow(/腳位號碼/)
  })
})
