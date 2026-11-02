/**
 * 時間兩顆（第 0 批）的自證測：`cpp:micros` / `cpp:delay_microseconds`。
 *
 * ⚠️ **寫在一起，因為它們共用同一個時鐘**——與 `cpp:delay`／`cpp:millis` 也是同一個。
 * 分開測的話「`delayMicroseconds` 推進了而 `micros` 讀得到」**沒有任何一支測得到**。
 *
 * 🔴 執行那幾條由 Cella 的板子判決背書（spec 201）。原本 JS 直譯器的時鐘是**毫秒解析度**，
 * 所以這裡曾經釘住「`micros()` 的低三位永遠是 0」這個刻意的不擬真；
 * Cella 的板子模型照 AVR 核心的 timer0（4 µs 一格）算 `micros()`，那個不擬真跟著 JS 直譯器一起退場。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { generateCode } from '../../../core/projection/code-generator'
import apcs from '../../../languages/cpp/styles/apcs.json'
import { expectCellaOut } from '../../../../tests/helpers/cella-run'
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
describe('cpp:micros / cpp:delay_microseconds', () => {
  it('lift —— 認得出兩顆身分', () => {
    const ids = collect(lift('void setup() { delayMicroseconds(10); }\nvoid loop() {}\n'))
    // ← 正向錨點：先證明量到了東西，否則下面的負向會空過
    expect(ids).toContain('cpp:delay_microseconds')
    expect(ids).not.toContain('cpp:raw_code')

    const ids2 = collect(lift('void setup() { unsigned long t = micros(); }\nvoid loop() {}\n'))
    expect(ids2).toContain('cpp:micros')
    expect(ids2).not.toContain('cpp:raw_code')
  })

  it('generate —— 產回原本的呼叫', () => {
    const code = generateCode(lift('void setup() { delayMicroseconds(500); }\nvoid loop() {}\n'), 'cpp', apcs as StylePreset)
    expect(code).toContain('delayMicroseconds(500)')
  })

  it('round-trip —— 兩顆一起走一趟', () => {
    const src = 'void setup() {\n  unsigned long t = micros();\n  delayMicroseconds(250);\n}\nvoid loop() {\n}\n'
    const once = generateCode(lift(src), 'cpp', apcs as StylePreset)
    const twice = generateCode(lift(once), 'cpp', apcs as StylePreset)
    expect(twice).toBe(once)
  })

  it('🔴 執行 —— `delayMicroseconds` 推進的時間 `micros` 讀得到（同一個時鐘）', async () => {
    // 原本是 int main() ＋ cout（JS 直譯器才收）；板子上沒有 cout，改成 sketch ＋ Serial（println 印 \r\n）
    await expectCellaOut(`
      void setup() {
        Serial.begin(9600);
        unsigned long a = micros();
        delayMicroseconds(3000);
        unsigned long b = micros();
        Serial.println(b - a);
      }
      void loop() {}
    `, '3000\r\n', { board: 'uno' })
  })

  it('★ 執行 —— `micros()` 是微秒解析度：`delayMicroseconds(1500)` 之後低三位是 500', async () => {
    // 🔴 期望值改了：原本 '0'（JS 直譯器的時鐘是毫秒解析度，刻意的不擬真）→ 現在 '500'。
    // 依據：AVR 核心的 micros() ＝ (timer0 溢位數 × 256 ＋ TCNT0) × 4 µs，解析度 4 µs；1500 是 4 的倍數，真板子讀得到 1500。
    await expectCellaOut(`
      void setup() {
        Serial.begin(9600);
        delayMicroseconds(1500);
        Serial.println(micros() % 1000);
      }
      void loop() {}
    `, '500\r\n', { board: 'uno' })
  })
})
