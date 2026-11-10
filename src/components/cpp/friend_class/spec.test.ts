/**
 * `cpp:friend_class` ＋ `cpp:friend_function` 的**自證測**（第 389 刀）。
 *
 * 推導不出來的四件事：
 *
 * ```
 * ① 兩顆都是元件（不是原文）：產回去、走一趟積木回來都一字不差，class／struct 不互換
 * ② 存取控制真的被量到：有 friend 判 accept，同一支拿掉 friend 判 reject
 * ③ friend 不是成員：寫在哪一節都一樣，Cella 收到的 mbFriend／mbFriendClass 沒有存取權
 * ④ 形狀不單純的（帶本體、限定名、沒寫 class、帶預設值）不准被吃掉——照實降級成原文
 * ```
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

describe('friend 宣告', () => {
  it.each([
    ['friend class', CLASS, 'cpp:friend_class', '7\n'],
    ['friend struct', STRUCT, 'cpp:friend_class', '7\n'],
    ['friend 函式', FUNC, 'cpp:friend_function', '5\n'],
  ])('★ %s：是元件、產回去與走一趟積木都一字不差、Cella 判得出', async (_n, src, id, out) => {
    const t = lift(src)
    expect(ofId(t, id)).toHaveLength(1)
    expect(all(t).filter((n) => /raw_code|unresolved/.test(n.componentId))).toEqual([])
    expect(generateCode(t, 'cpp', S).trimEnd()).toBe(src.trimEnd())
    expect(viaBlocks(src).trimEnd()).toBe(src.trimEnd())
    await expectCellaOut(src, out)
  })

  it('friend 運算子：是元件、來回一字不差；ostream 這個型別還沒有對應，照實翻不出（不送去被判錯）', async () => {
    const t = lift(OP)
    expect(ofId(t, 'cpp:friend_function')).toHaveLength(1)
    expect(generateCode(t, 'cpp', S).trimEnd()).toBe(OP.trimEnd())
    expect(viaBlocks(OP).trimEnd()).toBe(OP.trimEnd())
    const r = await runCella(OP)
    expect(r.verdict).toBe('untranslated')
    expect(r.untranslated.map((u) => u.reason).join('；')).toMatch(/ostream/)
  })

  it('屬性記得住 class／struct、回傳型別與參數', () => {
    expect(ofId(lift(STRUCT), 'cpp:friend_class')[0].properties).toMatchObject({ tag: 'struct', name: 'B' })
    const f = ofId(lift(OP), 'cpp:friend_function')[0]
    expect(f.properties).toMatchObject({ return_type: 'ostream&', name: 'operator<<' })
    expect(f.slots.params).toHaveLength(2)
  })

  it.each([
    ['class', CLASS, 'friend class B;'],
    ['函式', FUNC, 'friend int peek(const A& a);'],
  ])('🔴 存取控制：%s 有 friend 判 accept，同一支拿掉 friend 判 reject', async (_n, src, line) => {
    expect((await runCella(src)).verdict).toBe('accept')
    expect((await runCella(src.replace(`    ${line}\n`, ''))).verdict).toBe('reject')
  })

  it.each([
    ['帶本體', 'friend int get(A a) { return a.x; }'],
    ['限定名', 'friend void N::h();'],
    ['沒寫 class', 'friend B;'],
    ['帶預設值', 'friend void h(int a = 1);'],
    ['多層指標', 'friend int** p();'],
  ])('🔴 形狀不單純：%s 照實降級成原文，文字不變', (_n, line) => {
    const src = `class A {\n    int x;\n    ${line}\n};\n`
    const t = lift(src)
    expect(ofId(t, 'cpp:class_def')).toHaveLength(1)
    expect(ofId(t, 'cpp:friend_class')).toHaveLength(0)
    expect(ofId(t, 'cpp:friend_function')).toHaveLength(0)
    expect(generateCode(t, 'cpp', S)).toContain(line)
  })
})
