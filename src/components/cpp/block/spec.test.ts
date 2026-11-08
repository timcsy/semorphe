/**
 * `cpp:block` 的自證測（2026-11-08）：本體多縮一層；case 底下與頂層的 `{ … }` 都照實是一顆區塊。
 * 起因：union 盲測抓到 `case X: { int b = …; }` 的大括號被展平（編不過）；修好之後產出的 `{` 自成一行、本體沒縮排。
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
const lift = (src: string): SemanticNode => createTestLifter().lift(parser.parse(src)!.rootNode as never) as SemanticNode
const gen = (t: SemanticNode): string => generateCode(t, 'cpp', apcs as StylePreset)
const ids = (n: SemanticNode, acc: string[] = []): string[] => { acc.push(n.componentId); Object.values(n.slots ?? {}).flat().forEach((c) => ids(c, acc)); return acc }

const H = '#include <iostream>\nusing namespace std;\n'
const STANDALONE = H + 'int main() {\n    int x = 1;\n    {\n        int x = 2;\n        cout << x << endl;\n    }\n    cout << x << endl;\n}\n'
const CASE = H + 'int f(int op) {\n    switch (op) {\n        case 1:\n            {\n                int b = 3;\n                return b;\n            }\n        default:\n            return 0;\n    }\n}\nint main() {\n    cout << f(1) << endl;\n}\n'

describe('cpp:block', () => {
  it('獨立區塊：本體多縮一層、來回一字不差、內層的 x 遮蔽外層', async () => {
    const t = lift(STANDALONE)
    expect(ids(t)).toContain('cpp:block')
    expect(gen(t).trimEnd()).toBe(STANDALONE.trimEnd())
    await expectCellaOut(STANDALONE, '2\n1\n')
  }, 120_000)
  it('case 底下的 `{ … }` 是一層作用域：照實是一顆區塊、縮排正確', async () => {
    const t = lift(CASE)
    expect(ids(t)).toContain('cpp:block')
    expect(gen(t).trimEnd()).toBe(CASE.trimEnd())
    await expectCellaOut(CASE, '3\n')
  }, 120_000)
  it('頂層的 `{ … }`（C++ 不准）照實是一顆區塊，不展平成檔案範圍的敘述', () => {
    const t = lift('{\n    int x = 1;\n}\n')
    expect(t.slots?.body?.map((n) => n.componentId)).toEqual(['cpp:block'])
  })
})
