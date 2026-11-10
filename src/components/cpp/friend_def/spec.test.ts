/**
 * `cpp:friend_def` 的**自證測**（第 394 刀）：帶本體的 friend 是元件、來回一字不差、形狀不單純的照實降級，判決等 Cella 的新建構子。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { setupTestRenderer } from '../../../../tests/helpers/setup-renderer'
import { runCella } from '../../../../tests/helpers/cella-run'
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
const plainFriend = head + 'class A {\npublic:\n    A() {\n        x = 5;\n    }\n    friend int peek(const A& a) {\n        return a.x;\n    }\nprivate:\n    int x;\n};\nint main() {\n    A a;\n    cout << peek(a) << endl;\n    return 0;\n}\n'
const OP = head + 'class P {\npublic:\n    P() {\n        x = 3;\n    }\n    friend ostream& operator<<(ostream& os, const P& p) {\n        os << "P=" << p.x;\n        return os;\n    }\nprivate:\n    int x;\n};\nint main() {\n    P p;\n    cout << p << endl;\n    return 0;\n}\n'

describe('帶本體的 friend 函式', () => {
  it.each([
    ['一般函式', plainFriend, 'peek', 'int'],
    ['輸出運算子', OP, 'operator<<', 'ostream&'],
  ])('★ %s：是元件、產回去與走一趟積木都一字不差', (_n, src, name, ret) => {
    const t = lift(src)
    const f = ofId(t, 'cpp:friend_def')
    expect(f).toHaveLength(1)
    expect(f[0].properties).toMatchObject({ return_type: ret, name })
    expect(f[0].slots.body.length).toBeGreaterThan(0)
    expect(ofId(t, 'cpp:friend_function')).toHaveLength(0)
    expect(all(t).filter((n) => /raw_code|unresolved/.test(n.componentId))).toEqual([])
    expect(generateCode(t, 'cpp', S).trimEnd()).toBe(src.trimEnd())
    expect(viaBlocks(src).trimEnd()).toBe(src.trimEnd())
  })

  it('本體裡的輸出認得成串流寫入（不是原文）', () => {
    const t = lift(OP)
    expect(ofId(t, 'cpp:friend_def')).toHaveLength(1)
    expect(ofId(t, 'cpp:stream_write')).toHaveLength(1)
  })

  it('只有原型的 friend 維持原本那顆元件', () => {
    const t = lift('class A {\n    int x;\n    friend int peek(const A& a);\n};\n')
    expect(ofId(t, 'cpp:friend_function')).toHaveLength(1)
    expect(ofId(t, 'cpp:friend_def')).toHaveLength(0)
  })

  it.each([
    ['限定名', 'friend void N::h() {\n    }'],
    ['帶預設值', 'friend void h(int a = 1) {\n    }'],
  ])('🔴 形狀不單純：%s 照實降級成原文，文字不變', (_n, line) => {
    const src = 'class A {\n    int x;\n    ' + line + '\n};\n'
    const t = lift(src)
    expect(ofId(t, 'cpp:class_def')).toHaveLength(1)
    expect(ofId(t, 'cpp:friend_def')).toHaveLength(0)
    expect(generateCode(t, 'cpp', S)).toContain(line)
  })

  // Cella 的 mbFriendDef 談定了（2026-11-10，下一版）：不能攤平成頂層函式，類別的語彙範圍會不見。發布前照實翻不出
  it('🟡 Cella 還沒有對應：照實翻不出，不猜', async () => {
    const r = await runCella(plainFriend)
    expect(r.verdict).toBe('untranslated')
    expect(r.untranslated.some((u) => /這顆類別成員還沒有對應/.test(u.reason))).toBe(true)
  })
})
