/**
 * `cpp:stream_write` 的**自證測**（第 392 刀）。
 *
 * ① 根變數宣告成 ostream 才是寫入，積木與產碼來回一字不差
 * ② 自訂類別的 `<<` 與整數位移不准被吃掉
 * ③ `return os << x` 等於先寫再回傳；其他運算式位置 Cella 沒有對應，要照實 untranslated，不能送位移被誤判 reject
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { setupTestRenderer } from '../../../../tests/helpers/setup-renderer'
import { expectCellaOut, runCella } from '../../../../tests/helpers/cella-run'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { generateCode } from '../../../core/projection/code-generator'
import { renderToBlocklyState } from '../../../core/projection/block-renderer'
import { PatternExtractor } from '../../../core/projection/pattern-extractor'
import { BlockSpecRegistry } from '../../../core/blocks/block-spec-registry'
import { allCppComponents, allCppProjections } from '../../../languages/cpp/all-declarations'
import { registerCppExtractStrategies } from '../../../languages/cpp/extractors/extract-strategies'
import apcs from '../../../languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../../core/types'

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
const CLASS = `${head}class A {\npublic:\n    A() {\n        x = 7;\n    }\nprivate:\n    int x;\n    friend class B;\n};\nclass B {\npublic:\n    int read(A a) {\n        return a.x;\n    }\n};\nint main() {\n    A a;\n    B b;\n    cout << b.read(a) << endl;\n    return 0;\n}\n`
const STRUCT = CLASS.replace('friend class B;', 'friend struct B;').replace('class B {\npublic:\n', 'struct B {\n')
const FUNC = `${head}class A {\npublic:\n    A() {\n        x = 5;\n    }\nprivate:\n    int x;\n    friend int peek(const A& a);\n};\nint peek(const A& a) {\n    return a.x;\n}\nint main() {\n    A a;\n    cout << peek(a) << endl;\n    return 0;\n}\n`
const OP = `${head}class A {\npublic:\n    friend ostream& operator<<(ostream& os, const A& a);\n    A() {\n        x = 3;\n    }\nprivate:\n    int x;\n};\nostream& operator<<(ostream& os, const A& a) {\n    os << a.x;\n    return os;\n}\nint main() {\n    A a;\n    cout << a << endl;\n    return 0;\n}\n`

const H = '#include <iostream>\nusing namespace std;\n'
const FREE = H + 'class A {\npublic:\n    int x;\n};\nostream& operator<<(ostream& os, const A& a) {\n    os << a.x;\n    return os;\n}\nint main() {\n    A a;\n    a.x = 3;\n    cout << a << endl;\n    return 0;\n}\n'
const FRIEND = H + 'class A {\npublic:\n    A(int v) : x(v) {\n    }\n    friend ostream& operator<<(ostream& os, const A& a);\nprivate:\n    int x;\n};\nostream& operator<<(ostream& os, const A& a) {\n    os << a.x;\n    return os;\n}\nint main() {\n    A a(3);\n    cout << a << endl;\n    return 0;\n}\n'
const CHAIN = H + 'void show(ostream& out, int a, int b) {\n    out << a << " " << a + b << endl;\n}\nint main() {\n    show(cout, 1, 2);\n    return 0;\n}\n'
const RET = H + 'ostream& w(ostream& os, int a) {\n    return os << a;\n}\nint main() {\n    w(cout, 1);\n    return 0;\n}\n'

describe('寫到串流', () => {
  it.each([['自由函式', FREE, '3\n'], ['朋友原型加類別外定義', FRIEND, '3\n'], ['鏈式', CHAIN, '1 3\n']])('%s：判決、輸出、來回', async (_n, code, out) => {
    const t = lift(code)
    expect(ofId(t, 'cpp:stream_write')).toHaveLength(1)
    expect(all(t).filter((x) => /raw_code|unresolved/.test(x.componentId))).toEqual([])
    expect(generateCode(t, 'cpp', S).trimEnd()).toBe(code.trimEnd())
    expect(viaBlocks(code).trimEnd()).toBe(code.trimEnd())
    await expectCellaOut(code, out)
  }, 120_000)

  it('鏈式的值依序收在同一顆，endl 是換行元件', () => {
    const w = ofId(lift(CHAIN), 'cpp:stream_write')[0]
    expect(w.slots.stream[0].properties.name).toBe('out')
    expect(w.slots.values).toHaveLength(4)
    expect(w.slots.values[3].componentId).toBe('cpp:endl')
  })

  it('整數位移維持原本的運算', () => {
    const t = lift(H + 'int main() {\n    int os = 1;\n    int y = os << 2;\n    cout << y;\n    return 0;\n}\n')
    expect(ofId(t, 'cpp:print')).toHaveLength(1)
    expect(ofId(t, 'cpp:stream_write')).toEqual([])
  })

  it('自訂類別的 << 維持原本的運算', () => {
    const t = lift(H + 'class Log {\npublic:\n    int n;\n    Log& operator<<(int x);\n};\nint main() {\n    Log l;\n    l << 1;\n    return 0;\n}\n')
    expect(ofId(t, 'cpp:var_declare').length + ofId(t, 'cpp:class_def').length).toBeGreaterThan(0)
    expect(ofId(t, 'cpp:stream_write')).toEqual([])
  })

  it('回傳位置：來回不變，等於先寫再回傳串流，判 accept', async () => {
    const t = lift(RET)
    expect(ofId(t, 'cpp:stream_write')).toHaveLength(1)
    expect(generateCode(t, 'cpp', S).trimEnd()).toBe(RET.trimEnd())
    expect((await runCella(RET, {})).verdict).toBe('accept')
  }, 120_000)

  it('其他運算式位置：判決照實翻不出，不送位移', async () => {
    const c = '#include <iostream>\nusing namespace std;\nvoid f(ostream& os) {\n    if (os << 1) {\n        os << 2;\n    }\n}\nint main() {\n    f(cout);\n    return 0;\n}\n'
    const r = await runCella(c, {})
    expect(r.verdict).toBe('untranslated')
    expect(r.untranslated.map((u) => u.construct)).toContain('cpp:stream_write')
  }, 120_000)
})
