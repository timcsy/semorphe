/**
 * **union 的 round-trip**（元件管線 345，2026-11-08）：五支程式，各量四件事——
 * ① 語義樹裡是 `cpp:union_declare`（元件身分，不是原文、不是結構）② lift → 產碼 → 再 lift 同一棵
 * ③ 走一趟積木（render → extract → 產碼）一字不差 ④ 交給 Cella 的輸出等於 gcc／g++ 當時印的（寫死在下面，量於 2026-11-08）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { setupTestRenderer } from '../helpers/setup-renderer'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { renderToBlocklyState } from '../../src/core/projection/block-renderer'
import { PatternExtractor } from '../../src/core/projection/pattern-extractor'
import { BlockSpecRegistry } from '../../src/core/blocks/block-spec-registry'
import { allCppComponents, allCppProjections } from '../../src/languages/cpp/all-declarations'
import { registerCppExtractStrategies } from '../../src/languages/cpp/extractors/extract-strategies'
import { expectCellaOut } from '../helpers/cella-run'
import cStyle from '../../src/languages/cpp/styles/c.json'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

interface Prog { id: string; lang: 'c' | 'cpp'; desc: string; code: string; out: string }
const PROGS: Prog[] = [
  {
    "id": "u1",
    "lang": "c",
    "desc": "基本：存 int 再存 char",
    "code": "#include <stdio.h>\nunion U {\n    int i;\n    char c;\n};\nint main(void) {\n    union U u;\n    u.i = 65;\n    printf(\"%d\\n\", u.i);\n    u.c = 'z';\n    printf(\"%c\\n\", u.c);\n    return 0;\n}\n",
    "out": "65\nz\n"
  },
  {
    "id": "u2",
    "lang": "c",
    "desc": "typedef 匿名 union ＋ sizeof(別名)",
    "code": "#include <stdio.h>\ntypedef union {\n    int i;\n    float f;\n} Num;\nint main(void) {\n    Num n;\n    n.f = 1.5f;\n    printf(\"%.1f %d\\n\", n.f, (int)sizeof(Num));\n    return 0;\n}\n",
    "out": "1.5 4\n"
  },
  {
    "id": "u3",
    "lang": "c",
    "desc": "union 當結構的成員",
    "code": "#include <stdio.h>\nunion Val {\n    int i;\n    double d;\n};\nstruct Cell {\n    int tag;\n    union Val v;\n};\nint main(void) {\n    struct Cell a;\n    a.tag = 1;\n    a.v.d = 2.25;\n    if (a.tag == 1) {\n        printf(\"%.2f\\n\", a.v.d);\n    }\n    return 0;\n}\n",
    "out": "2.25\n"
  },
  {
    "id": "u4",
    "lang": "c",
    "desc": "union 陣列、當函式參數、sizeof(union Num)",
    "code": "#include <stdio.h>\nunion Num {\n    int i;\n    long long l;\n};\nint twice(union Num n) {\n    return n.i * 2;\n}\nint main(void) {\n    union Num xs[3];\n    int k;\n    for (k = 0; k < 3; k++) {\n        xs[k].i = k + 1;\n    }\n    printf(\"%d %d\\n\", twice(xs[2]), (int)sizeof(union Num));\n    return 0;\n}\n",
    "out": "6 8\n"
  },
  {
    "id": "u5",
    "lang": "cpp",
    "desc": "C++：不寫 union 關鍵字的型別名",
    "code": "#include <iostream>\nusing namespace std;\nunion U {\n    int i;\n    double d;\n};\nint main() {\n    U u;\n    u.d = 2.5;\n    cout << u.d << endl;\n    u.i = 7;\n    cout << u.i << endl;\n}\n",
    "out": "2.5\n7\n"
  }
]

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
})
const lift = (src: string): SemanticNode => createTestLifter().lift(parser.parse(src)!.rootNode as never) as SemanticNode
const shape = (n: SemanticNode): unknown => [n.componentId, n.properties, Object.entries(n.slots ?? {}).map(([k, v]) => [k, v.map(shape)])]
const find = (n: SemanticNode, id: string, acc: SemanticNode[] = []): SemanticNode[] => { if (n.componentId === id) acc.push(n); Object.values(n.slots ?? {}).flat().forEach((c) => find(c, id, acc)); return acc }
const raws = (n: SemanticNode): number => (n.componentId.includes('raw') ? 1 : 0) + Object.values(n.slots ?? {}).flat().reduce((a, c) => a + raws(c), 0)
const styleOf = (p: Prog): StylePreset => (p.lang === 'c' ? cStyle : apcs) as StylePreset

describe('union 的 round-trip', () => {
  for (const p of PROGS) {
    it(`${p.id}：${p.desc}——身分、來回、積木`, () => {
      const t = lift(p.code)
      const u = find(t, 'cpp:union_declare')
      expect(u.length).toBe(1)
      expect(raws(t)).toBe(0)
      const out = generateCode(t, 'cpp', styleOf(p))
      expect(out.trimEnd()).toBe(p.code.trimEnd())
      expect(JSON.stringify(shape(lift(out)))).toBe(JSON.stringify(shape(t)))
      const state = renderToBlocklyState(t) as { blocks: { blocks: unknown[] } }
      const back = state.blocks.blocks.flatMap((b) => ex.extractStatementChain(b as never))
      const viaBlocks = generateCode({ id: 'root', componentId: 'cpp:program', properties: {}, slots: { body: back } } as never, 'cpp', styleOf(p))
      expect(viaBlocks.trimEnd()).toBe(p.code.trimEnd())
    })
    it(`★ ${p.id}：Cella 的輸出等於 gcc／g++`, async () => {
      await expectCellaOut(p.code, p.out, { lang: p.lang })
    }, 120_000)
  }
})
