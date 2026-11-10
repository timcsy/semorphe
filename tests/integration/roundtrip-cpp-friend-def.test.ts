/**
 * `cpp:friend_def` 的 round-trip（第 394 刀，元件管線）。AS_MEMBER 刻意留成反引號字串：宣告接點的護欄靠語料掃到這顆元件。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { setupTestRenderer } from '../helpers/setup-renderer'
import { runCella } from '../helpers/cella-run'
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

const shape = (n: SemanticNode): unknown => [n.componentId, n.properties, Object.fromEntries(Object.entries(n.slots ?? {}).map(([k, v]) => [k, v.map(shape)]))]
const AS_MEMBER = `class Box {
public:
    Box(int v) {
        n = v;
    }
    friend int unwrap(const Box& b) {
        return b.n;
    }
private:
    int n;
};
`

const wrap = (m: string): string => 'class A {\npublic:\n' + m + 'private:\n    int x;\n};\n'
const CASES: [string, string, string, string][] = [
  ['回傳指標', wrap('    friend int* addr(A& a) {\n        return &a.x;\n    }\n'), 'addr', 'int*'],
  ['回傳 const 參考', wrap('    friend const int& ref(const A& a) {\n        return a.x;\n    }\n'), 'ref', 'const int&'],
  ['回傳 void、本體有控制流程', wrap('    friend void bump(A& a, int k) {\n        for (int i = 0; i < k; i++) {\n            if (a.x < 10) {\n                a.x++;\n            }\n        }\n    }\n'), 'bump', 'void'],
  ['比較運算子', wrap('    friend bool operator==(const A& p, const A& q) {\n        return p.x == q.x;\n    }\n'), 'operator==', 'bool'],
  ['空本體', wrap('    friend void nop(A a) {\n    }\n'), 'nop', 'void'],
]

describe('roundtrip：帶本體的 friend', () => {
  it('入口條件：當成參數形式的樣本認得出來', () => {
    expect(ofId(lift(AS_MEMBER), 'cpp:friend_def')).toHaveLength(1)
  })

  it.each(CASES)('★ %s：元件身分、一字不差、再 lift 不漂移、走積木回來相同', (_n, src, name, ret) => {
    const t = lift(src)
    const [f] = ofId(t, 'cpp:friend_def')
    expect(f.properties).toMatchObject({ name, return_type: ret })
    expect(all(t).filter((n) => /raw_code|unresolved/.test(n.componentId))).toEqual([])
    const out = generateCode(t, 'cpp', S)
    expect(out.trimEnd()).toBe(src.trimEnd())
    expect(shape(lift(out))).toEqual(shape(t))
    expect(viaBlocks(src).trimEnd()).toBe(src.trimEnd())
  })

  it('類別裡多個 friend：原型、定義與朋友類別各自留著，順序不變', () => {
    const src = wrap('    friend class B;\n    friend int f(A a);\n    friend int g(A a) {\n        return a.x;\n    }\n')
    const t = lift(src)
    expect(ofId(t, 'cpp:friend_class')).toHaveLength(1)
    expect(ofId(t, 'cpp:friend_function')).toHaveLength(1)
    expect(ofId(t, 'cpp:friend_def')).toHaveLength(1)
    expect(generateCode(t, 'cpp', S).trimEnd()).toBe(src.trimEnd())
    expect(viaBlocks(src).trimEnd()).toBe(src.trimEnd())
  })

  it('大括號換行的風格：本體前的括號跟著風格走，再 lift 相同', () => {
    const t = lift(wrap('    friend int g(A a) {\n        return a.x;\n    }\n'))
    const out = generateCode(t, 'cpp', { ...S, brace_style: 'Allman' } as StylePreset)
    expect(out).toContain('friend int g(A a)\n    {')
    expect(shape(lift(out))).toEqual(shape(t))
  })

  it('本體裡用得到參數：參數名在本體裡是變數，不是降級', () => {
    const t = lift(wrap('    friend int twice(A a) {\n        int r = a.x * 2;\n        return r;\n    }\n'))
    expect(ofId(t, 'cpp:friend_def')[0].slots.body).toHaveLength(2)
  })
})
