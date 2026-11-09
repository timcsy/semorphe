/**
 * `cpp:var_declare_ref` 的自證測：參照宣告——含**指標的參照**（`int*& slot = …`）。
 *
 * 🔴 2026-11-09（cella 2213 升級時露出來）：`Node*& slot = (v < val) ? left : right;` 被 lift 成 `int* ptr = …`——
 *    名字與參照都掉了（宣告子是 pointer → reference → identifier，剝指標停在參照那一層，名字落到預設 `'ptr'`）。
 *    一段合法而意思不同的程式（P6）；類別外定義的盲測 fuzz_4 之前被 `Node::created` 翻不出擋住，`C::n` 接上之後才看得見。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { expectCellaOut } from '../../../../tests/helpers/cella-run'
import { registerCppLanguage } from '../../../languages/cpp/generators'
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
const lift = (src: string): SemanticNode => createTestLifter().lift(parser.parse(src)!.rootNode as never) as SemanticNode
const decls = (t: SemanticNode): SemanticNode[] => {
  const out: SemanticNode[] = []
  const walk = (n: SemanticNode): void => { if (/declare/.test(n.componentId)) out.push(n); for (const k of Object.values(n.slots ?? {})) k.forEach(walk) }
  walk(t)
  return out
}

describe('膠囊自證：參照宣告', () => {
  it('★ 指標的參照：名字、參照、星號都保住；產碼一字不差', () => {
    const src = H + 'int main() {\n    int a = 1;\n    int* pa = &a;\n    int*& slot = pa;\n    int** ppa = &pa;\n    int**& deep = ppa;\n    return 0;\n}\n'
    const t = lift(src)
    const slot = decls(t).find((n) => n.properties.name === 'slot')
    expect(slot?.componentId).toBe('cpp:var_declare_ref')
    expect(slot?.properties.type).toBe('int*')
    expect(decls(t).some((n) => n.properties.name === 'ptr')).toBe(false)
    expect(decls(t).find((n) => n.properties.name === 'deep')?.properties.type).toBe('int**')
    const code = generateCode(t, 'cpp', apcs as unknown as StylePreset)
    expect(code).toContain('int*& slot = pa;')
    expect(code).toContain('int**& deep = ppa;')
  })
  it('★ 指標的參照：Cella 判得出，改 slot 就是改它指到的那個指標', async () => {
    await expectCellaOut(H + 'int main() {\n    int a = 1, b = 2;\n    int* pa = &a;\n    int* pb = &b;\n    int*& slot = (a < b) ? pa : pb;\n    slot = nullptr;\n    cout << (pa == nullptr) << " " << (pb == nullptr) << endl;\n    return 0;\n}\n', '1 0\n')
  }, 120_000)
})
