/**
 * `cpp:analog_resolution` 的自證測。
 *
 * 🔴 **這一顆今天沒有可觀察的效果**，所以執行那一路測的是
 * 「它不中止程式」與「參數不合理時**出聲**」——
 * 而不是假裝去驗一個不存在的副作用。
 *
 * > **一顆刻意沒有效果的元件，要測的是「它有沒有安靜地說謊」。**
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
  out.push(n.conceptId)
  for (const ks of Object.values(n.children ?? {})) for (const k of ks) collect(k, out)
  return out
}
const run = async (c: string): Promise<string> => {
  const i = new SemanticInterpreter({ maxSteps: 100_000 })
  await i.execute(lift(c))
  return i.getOutput().join('')
}

describe('cpp:analog_resolution', () => {
  it('lift —— 認得出身分（而它不叫 analog_read_resolution）', () => {
    const ids = collect(lift('void setup() { analogReadResolution(12); }\nvoid loop() {}\n'))
    expect(ids).toContain('cpp:analog_resolution')   // ← 正向錨點
    expect(ids).not.toContain('cpp:raw_code')
  })

  it('generate —— 產回原本的呼叫', () => {
    const code = generateCode(lift('void setup() { analogReadResolution(12); }\nvoid loop() {}\n'), 'cpp', apcs as StylePreset)
    expect(code).toContain('analogReadResolution(12)')
  })

  it('round-trip —— 不漂移', () => {
    const src = 'void setup() {\n  analogReadResolution(12);\n}\nvoid loop() {\n}\n'
    const once = generateCode(lift(src), 'cpp', apcs as StylePreset)
    expect(generateCode(lift(once), 'cpp', apcs as StylePreset)).toBe(once)
  })

  it('🔴 執行 —— 不中止程式（後面的東西照跑）', async () => {
    const out = await run(`
      #include <iostream>
      using namespace std;
      int main() {
        analogReadResolution(12);
        cout << "still running" << endl;
        return 0;
      }
    `)
    expect(out.trim()).toBe('still running')
  })

  it('⚠️ 參數不合理要【出聲】——什麼都不做又不出聲是最難查的錯', async () => {
    await expect(run('int main() { analogReadResolution(99); return 0; }'))
      .rejects.toThrow(/解析度/)
  })
})
