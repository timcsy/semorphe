/**
 * 序列埠輸入兩顆的自證測：`cpp:serial_count` / `cpp:serial_read`。
 *
 * ⚠️ **寫在一起，因為它們在真實程式裡成對出現**
 * （`while (Serial.available()) { c = Serial.read(); }`）——而那個配對本身要被測到。
 *
 * ## 🔴 而最重要的一條是那個 `-1`
 *
 * `Serial.read()` 沒有資料時回 **-1，不是 0**。那是 Arduino 初學者最常見的陷阱之一，
 * 而**一個把陷阱藏起來的模擬器，會讓學生在真板子上第一次遇到它**。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { generateCode } from '../../../core/projection/code-generator'
import { expectCellaOut } from '../../../../tests/helpers/cella-run'
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
describe('cpp:serial_count / cpp:serial_read', () => {
  it('lift —— 成對的那個寫法認得出兩顆', () => {
    const ids = collect(lift(
      'void loop() {\n  while (Serial.available()) {\n    int c = Serial.read();\n  }\n}\n'))
    expect(ids).toContain('cpp:serial_count')   // ← 正向錨點
    expect(ids).toContain('cpp:serial_read')
    expect(ids).not.toContain('cpp:raw_code')
  })

  it('⚠️ 判別要看 obj —— 別的物件的 read 不得被搶走', () => {
    const ids = collect(lift('void loop() { ifstream f("a.txt"); }\n'))
    expect(ids).not.toContain('cpp:serial_read')
  })

  it('generate —— 產回原本的方法呼叫', () => {
    const code = generateCode(lift(
      'void loop() {\n  while (Serial.available()) {\n    int c = Serial.read();\n  }\n}\n'),
      'cpp', apcs as StylePreset)
    expect(code).toContain('Serial.available()')
    expect(code).toContain('Serial.read()')
  })

  it('round-trip —— 不漂移', () => {
    const src = 'void loop() {\n  while (Serial.available()) {\n    int c = Serial.read();\n  }\n}\n'
    const once = generateCode(lift(src), 'cpp', apcs as StylePreset)
    expect(generateCode(lift(once), 'cpp', apcs as StylePreset)).toBe(once)
  })

  // 原本三條都是 int main() ＋ cout（JS 直譯器才收）；板子上沒有 cout，改成 sketch ＋ Serial（println 印 \r\n，AVR 核心 Print::println）。
  it('🔴 執行 —— 沒有資料時 read 回 -1（不是 0），而那正是那個陷阱', async () => {
    // 依據：AVR 核心 HardwareSerial::read() 緩衝空時 return -1；available() 回 0
    await expectCellaOut(`
      void setup() {
        Serial.begin(9600);
        Serial.print(Serial.available());
        Serial.print(" ");
        Serial.println(Serial.read());
      }
      void loop() {}
    `, '0 -1\r\n', { board: 'uno' })
  })

  it('🔴 而 -1 在條件裡是【真】——這條把陷阱本身釘住', async () => {
    // ⚠️ 學生寫 `if (Serial.read())` 會以為「沒資料就不進去」——而它進去了
    await expectCellaOut(`
      void setup() {
        Serial.begin(9600);
        if (Serial.read()) Serial.println("truthy");
        else Serial.println("falsy");
      }
      void loop() {}
    `, 'truthy\r\n', { board: 'uno' })
  })

  it('成對的迴圈不會空轉（可讀數是 0 → 迴圈一次都不跑；有 3 個位元組 → 跑 3 次）', async () => {
    const SRC = `
      void setup() {
        Serial.begin(9600);
        int n = 0;
        while (Serial.available()) { Serial.read(); n = n + 1; }
        Serial.println(n);
      }
      void loop() {}
    `
    await expectCellaOut(SRC, '0\r\n', { board: 'uno' })
    // ← 正向錨點：餵了輸入時迴圈真的會跑——否則上面的 0 分不出「沒資料」與「available 永遠是 0」
    await expectCellaOut(SRC, '3\r\n', { board: 'uno', stdin: 'abc' })
  })
})
