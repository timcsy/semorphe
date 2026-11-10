/**
 * **寫到 ostream 的 round-trip**（元件管線 392，2026-11-10）。量四件事：① 語義樹裡是這顆元件
 * ② lift → 產碼 → 再 lift 同一棵 ③ 走一趟積木回來一字不差 ④ Cella 的輸出（期望值已用 clang++ 實跑核對）。
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
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'
import { expectCellaOut } from '../helpers/cella-run'

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

// 🔴 刻意用反引號：這段會進 audit-declared-slots 的語料，那條護欄才量得到這顆的接點
const AS_PARAM = `void show(ostream& os, int x) {
  os << x << 1;
}
`

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
const CLASS = `${head}class A {\npublic:\n    A() {\n        x = 7;\n    }\nprivate:\n    int x;\n    friend class B;\n};\nclass B {\npublic:\n    int read(A a) {\n        return a.x;\n    }\n};\nint main() {\n    A a;\n    B b;\n    cout << b.read(a) << endl;\n    return 0;\n}\n`
const STRUCT = CLASS.replace('friend class B;', 'friend struct B;').replace('class B {\npublic:\n', 'struct B {\n')
const FUNC = `${head}class A {\npublic:\n    A() {\n        x = 5;\n    }\nprivate:\n    int x;\n    friend int peek(const A& a);\n};\nint peek(const A& a) {\n    return a.x;\n}\nint main() {\n    A a;\n    cout << peek(a) << endl;\n    return 0;\n}\n`
const OP = `${head}class A {\npublic:\n    friend ostream& operator<<(ostream& os, const A& a);\n    A() {\n        x = 3;\n    }\nprivate:\n    int x;\n};\nostream& operator<<(ostream& os, const A& a) {\n    os << a.x;\n    return os;\n}\nint main() {\n    A a;\n    cout << a << endl;\n    return 0;\n}\n`

const PROGS: [string, string, string, number][] = [
  ["自由函式 operator<<", "#include <iostream>\nusing namespace std;\nclass A {\npublic:\n    int x;\n};\nostream& operator<<(ostream& os, const A& a) {\n    os << a.x;\n    return os;\n}\nint main() {\n    A a;\n    a.x = 3;\n    cout << a << endl;\n    return 0;\n}\n", "3\n", 1],
  ["朋友原型加類別外定義", "#include <iostream>\nusing namespace std;\nclass A {\npublic:\n    A(int v) : x(v) {\n    }\n    friend ostream& operator<<(ostream& os, const A& a);\nprivate:\n    int x;\n};\nostream& operator<<(ostream& os, const A& a) {\n    os << \"A(\" << a.x << \")\";\n    return os;\n}\nint main() {\n    A a(3);\n    cout << a << \" \" << a << endl;\n    return 0;\n}\n", "A(3) A(3)\n", 1],
  ["鏈式、換行、運算式", "#include <iostream>\nusing namespace std;\nvoid show(ostream& out, int a, int b) {\n    out << a << \" \" << a + b << endl;\n}\nint main() {\n    show(cout, 1, 2);\n    return 0;\n}\n", "1 3\n", 1],
  ["區域 ostream 參考", "#include <iostream>\nusing namespace std;\nint main() {\n    ostream& o = cout;\n    o << 5 << endl;\n    return 0;\n}\n", "5\n", 1],
  ["std:: 前綴", "#include <iostream>\nusing namespace std;\nvoid f(std::ostream& os) {\n    os << 7;\n}\nint main() {\n    f(cout);\n    return 0;\n}\n", "7", 1],
  ["迴圈與條件裡", "#include <iostream>\nusing namespace std;\nvoid f(ostream& os, int n) {\n    for (int i = 0; i < n; i++) {\n        if (i > 0) {\n            os << \",\";\n        }\n        os << i;\n    }\n}\nint main() {\n    f(cout, 3);\n    return 0;\n}\n", "0,1,2", 2],
  ["值裡的位移要留括號", "#include <iostream>\nusing namespace std;\nvoid f(ostream& os, int a) {\n    os << (a << 1);\n}\nint main() {\n    f(cout, 3);\n    return 0;\n}\n", "6", 1],
]

const shape = (n: SemanticNode): unknown => [n.componentId, n.properties, Object.fromEntries(Object.entries(n.slots ?? {}).map(([k, v]) => [k, v.map(shape)]))]

describe('寫到串流的來回', () => {
  it('當參數傳進來的 ostream：接點是 stream 與 values', () => {
    const [w] = ofId(lift(AS_PARAM), 'cpp:stream_write')
    expect(w?.slots?.stream?.length).toBe(1)
    expect(w?.slots?.values?.length).toBe(2)
  })

  it.each(PROGS)('%s', async (_n, code, out, count) => {
    const t = lift(code)
    expect(ofId(t, 'cpp:stream_write')).toHaveLength(count)
    expect(all(t).filter((x) => /raw_code|unresolved/.test(x.componentId))).toEqual([])
    const gen = generateCode(t, 'cpp', S)
    expect(gen.trimEnd()).toBe(code.trimEnd())
    expect(shape(lift(gen))).toEqual(shape(t))
    expect(viaBlocks(code).trimEnd()).toBe(code.trimEnd())
    await expectCellaOut(code, out)
  }, 120_000)
})
