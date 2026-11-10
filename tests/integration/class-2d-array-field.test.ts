/**
 * 類別／struct 裡的二維陣列欄位（第 400 刀）：`int g[2][3];` 原本整行降級成原文，Cella 說「這顆類別成員還沒有對應」。
 * 現在走二維陣列那顆（同區域變數），翻成 `mbField` 的 `tArr(tArr(…))`。三維以上、帶初值的照舊降級。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { setupTestRenderer } from '../helpers/setup-renderer'
import { runCella, expectCellaOut } from '../helpers/cella-run'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { renderToBlocklyState } from '../../src/core/projection/block-renderer'
import { PatternExtractor } from '../../src/core/projection/pattern-extractor'
import { BlockSpecRegistry } from '../../src/core/blocks/block-spec-registry'
import { allCppComponents, allCppProjections } from '../../src/languages/cpp/all-declarations'
import { registerCppExtractStrategies } from '../../src/languages/cpp/extractors/extract-strategies'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

let parser: Parser
let ex: PatternExtractor
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
  setupTestRenderer()
  const reg = new BlockSpecRegistry()
  reg.loadFromSplit(allCppComponents(), allCppProjections())
  ex = new PatternExtractor()
  ex.loadBlockSpecs(reg.getAll())
  registerCppExtractStrategies(ex)
}, 120_000)

const S = apcs as unknown as StylePreset
const lift = (c: string): SemanticNode => createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode
const all = (n: SemanticNode, o: SemanticNode[] = []): SemanticNode[] => { o.push(n); for (const k of Object.values(n.slots ?? {})) for (const c of k) all(c, o); return o }
const ofId = (t: SemanticNode, id: string): SemanticNode[] => all(t).filter((n) => n.componentId === id)

function viaBlocks(src: string): string {
  const state = renderToBlocklyState(lift(src)) as unknown as { blocks: { blocks: { next?: { block: unknown } }[] } }
  const back: SemanticNode[] = []
  for (const b0 of state.blocks.blocks) {
    let cur: { next?: { block: unknown } } | undefined = b0
    while (cur) {
      const n = ex.extract(cur as never)
      if (n) back.push(n)
      cur = cur.next?.block as typeof cur
    }
  }
  return generateCode({ id: 'r', componentId: 'cpp:program', properties: {}, slots: { body: back } } as SemanticNode, 'cpp', S)
}

const head = '#include <iostream>\nusing namespace std;\n'
const STRUCT = head + 'struct Board {\n    int g[2][3];\n    char name[2][10];\n};\nint main() {\n    Board b;\n    for (int i = 0; i < 2; i++) {\n        for (int j = 0; j < 3; j++) {\n            b.g[i][j] = i * 3 + j;\n        }\n    }\n    b.name[1][0] = 65;\n    b.name[1][1] = 0;\n    cout << b.g[1][2] << " " << b.name[1] << endl;\n    return 0;\n}\n'
const CLASS = head + 'class Grid {\npublic:\n    int cell[3][3];\n    int sum() {\n        int s = 0;\n        for (int i = 0; i < 3; i++) {\n            for (int j = 0; j < 3; j++) {\n                s += cell[i][j];\n            }\n        }\n        return s;\n    }\n};\nint main() {\n    Grid g;\n    for (int i = 0; i < 3; i++) {\n        for (int j = 0; j < 3; j++) {\n            g.cell[i][j] = i + j;\n        }\n    }\n    cout << g.sum() << endl;\n    return 0;\n}\n'

describe('類別裡的二維陣列欄位', () => {
  it.each([['struct', STRUCT, '5 A\n'], ['class（方法讀欄位）', CLASS, '18\n']])('%s：是二維陣列那顆、產碼一字不差、Cella 判得出', async (_n, src, out) => {
    const t = lift(src)
    expect(ofId(t, 'cpp:array_2d_declare').length).toBeGreaterThan(0)
    expect(all(t).map((n) => n.componentId)).not.toContain('cpp:raw_code')
    expect(generateCode(t, 'cpp', S).trimEnd()).toBe(src.trimEnd())
    await expectCellaOut(src, out)
  })

  it('走一趟積木回來一字不差', () => {
    expect(viaBlocks(STRUCT).trimEnd()).toBe(STRUCT.trimEnd())
    expect(viaBlocks(CLASS).trimEnd()).toBe(CLASS.trimEnd())
  })

  it('三維與帶初值的照舊降級（原文保留）', async () => {
    for (const m of ['    int c[2][2][2];\n', '    int c[2][2] = {};\n']) {
      const src = head + 'struct T {\n' + m + '};\nint main() {\n    return 0;\n}\n'
      const t = lift(src)
      expect(ofId(t, 'cpp:raw_code').length).toBeGreaterThan(0)
      expect(generateCode(t, 'cpp', S).trimEnd()).toBe(src.trimEnd())
      expect((await runCella(src)).verdict).toBe('untranslated')
    }
  })
})
