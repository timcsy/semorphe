/**
 * 時間兩顆（第 0 批）的自證測：`cpp:micros` / `cpp:delay_microseconds`。
 *
 * ⚠️ **寫在一起，因為它們共用同一個時鐘**——與 `cpp:delay`／`cpp:millis` 也是同一個。
 * 分開測的話「`delayMicroseconds` 推進了而 `micros` 讀得到」**沒有任何一支測得到**。
 *
 * 🔴 而本檔要釘住一個**刻意的不擬真**：模擬時鐘的解析度是毫秒，
 * 所以 `micros()` 的低三位永遠是 0。
 * **那不是 bug，是「可重現比擬真重要」的後果**——而一個沒有被測試釘住的
 * 刻意行為，下一個人會把它當成 bug 修掉。
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { SemanticInterpreter } from '../../../interpreter/interpreter'
import { generateCode } from '../../../core/projection/code-generator'
import apcs from '../../../languages/cpp/styles/apcs.json'
import { resetClock, useRealTime } from '../../../languages/cpp/core/runtime/arduino-clock'
import type { SemanticNode, StylePreset } from '../../../core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})
afterEach(() => { useRealTime(false); resetClock() })

const lift = (c: string): SemanticNode =>
  createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode
const collect = (n: SemanticNode, out: string[] = []): string[] => {
  out.push(n.conceptId)
  for (const ks of Object.values(n.children ?? {})) for (const k of ks) collect(k, out)
  return out
}
const run = async (c: string): Promise<string> => {
  resetClock()
  const i = new SemanticInterpreter({ maxSteps: 100_000 })
  await i.execute(lift(c))
  return i.getOutput().join('')
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
    const out = await run(`
      #include <iostream>
      using namespace std;
      int main() {
        unsigned long a = micros();
        delayMicroseconds(3000);
        unsigned long b = micros();
        cout << (b - a) << endl;
        return 0;
      }
    `)
    // 3000 µs ＝ 3 ms，而時鐘是毫秒解析度 → 讀回來正好 3000
    expect(out.trim()).toBe('3000')
  })

  it('⚠️ 刻意的不擬真：`micros()` 的低三位永遠是 0（毫秒解析度）', async () => {
    const out = await run(`
      #include <iostream>
      using namespace std;
      int main() {
        delayMicroseconds(1500);
        cout << (micros() % 1000) << endl;
        return 0;
      }
    `)
    // 🔴 真板子會給 500；模擬給 0——而那是「可重現比擬真重要」的後果，不是 bug
    expect(out.trim()).toBe('0')
  })
})
