/**
 * `cpp:literal_char` 的自證測——**第三種形狀**（lift 是一整個 pattern 物件）。
 *
 * ⚠️ 每一條負向前面先釘一個正向錨點（skill 步驟 3）：
 * `not.toContain(…)` 在集合是空的時候也會過，**一支空過的測試與健康的長得一模一樣**。
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

const H = '#include <iostream>\nusing namespace std;\n'
const lift = (c: string): SemanticNode =>
  createTestLifter().lift(parser.parse(H + c)!.rootNode as never) as SemanticNode
const collect = (n: SemanticNode, out: string[] = []): string[] => {
  out.push(n.conceptId)
  for (const ks of Object.values(n.children ?? {})) for (const k of ks) collect(k, out)
  return out
}
const produce = (c: string): string => generateCode(lift(c), 'cpp', apcs as unknown as StylePreset)
async function run(c: string): Promise<string> {
  const i = new SemanticInterpreter({ maxSteps: 100000 })
  await i.execute(lift(c))
  return i.getOutput().join('')
}

describe('膠囊自證：cpp:literal_char', () => {
  // ── 基準的三個樣本（specs/114/baseline.json）逐字對 ──────────────
  it('★ 基準①：char c = \'x\'; cout << c;', async () => {
    expect(collect(lift(`int main(){ char c = 'x'; cout << c; }`))).toContain('cpp:literal_char')
    expect(produce(`int main(){ char c = 'x'; cout << c; }`)).toContain("char c = 'x'")
    expect(await run(`int main(){ char c = 'x'; cout << c; }`)).toBe('x')
  })

  it('★ 基準②：直接印字面', async () => {
    expect(await run(`int main(){ cout << 'B'; }`)).toBe('B')
  })

  it('★ 基準③：兩顆字元', async () => {
    const ids = collect(lift(`int main(){ char c = 'a'; char d = 'b'; cout << c << d; }`))
    expect(ids.filter((x) => x === 'cpp:literal_char'), '兩顆都要在').toHaveLength(2)
    expect(await run(`int main(){ char c = 'a'; char d = 'b'; cout << c << d; }`)).toBe('ab')
  })

  // ── 負向：前面都有正向錨點 ────────────────────────────────────
  it('★ 它不搶字串字面（負向——前面先釘正向）', () => {
    const ids = collect(lift(`int main(){ cout << "hi"; }`))
    expect(ids, '這段碼必須產出字串字面——否則量測沒跑到').toContain('cpp:literal_string')
    expect(ids).not.toContain('cpp:literal_char')
  })

  it('★ 它不搶整數字面（負向——前面先釘正向）', () => {
    const ids = collect(lift(`int main(){ cout << 5; }`))
    expect(ids, '這段碼必須產出數字字面——否則量測沒跑到').toContain('cpp:literal_number')
    expect(ids).not.toContain('cpp:literal_char')
  })

  // ── 這一顆特有：pattern 是 glob 直讀的，不靠任何登錄呼叫 ──────────
  it('★ 不呼叫任何登錄也拿得到 pattern（第三種形狀的關鍵）', async () => {
    const { componentLiftPatterns } = await import('../../../core/component/lift-patterns')
    const ids = (componentLiftPatterns() as { id?: string }[]).map((p) => p.id)
    expect(ids, 'glob 沒掃到膠囊的 lift-pattern.json → 這一路是空的').toContain('cpp:literal_char')
  })
})
