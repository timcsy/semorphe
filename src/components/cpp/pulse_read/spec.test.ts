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
import { runCella, expectCellaOut } from '../../../../tests/helpers/cella-run'
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
/**
 * spec 201：執行判準換成 Cella 的 Uno 板子判決。原本的程式是 `main` ＋ `cout`——AVR 沒有 `<iostream>`，
 * 改成 sketch 真正會寫的 `Serial.println`（程式的意思不變）。`echo:<腳位>` 是環境給 `pulseIn` 的脈衝寬度（微秒）。
 */
const S = (setup: string): string => `void setup(){ Serial.begin(9600); ${setup} }\nvoid loop(){}\n`

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
    await expectCellaOut(S('long d = pulseIn(7, HIGH); Serial.println(d);'), '0\r\n', { board: 'uno' })
    // 而接了東西就讀得到寬度——回 0 不是「還沒實作」
    await expectCellaOut(S('long d = pulseIn(7, HIGH); Serial.println(d);'), '1200\r\n',
      { board: 'uno', inputs: [{ t: 0, key: 'echo:7', value: 1200 }] })
  })

  it('🔴 它是【運算式】——回傳值進得了算術，不會炸', async () => {
    // ⚠️ 這一條就是「為什麼不能 skipPaths」的執行機構：
    //    安靜 return undefined 的話，這裡的乘法會把 undefined 餵給 toNumber。
    await expectCellaOut(S('long cm = pulseIn(7, HIGH) * 0.034 / 2; Serial.println(cm);'), '0\r\n', { board: 'uno' })
  })

  it('⚠️ 腳位超出範圍要出聲，不是安靜回 0', async () => {
    const r = await runCella(S('long d = pulseIn(99, HIGH);'), { board: 'uno' })
    expect(r.verdict).toBe('reject')
    expect(r.problems[0]?.kind).toBe('ubPin')
    expect(r.problems[0]?.reason).toMatch(/pin 99 is not on the board/)
  })
})
