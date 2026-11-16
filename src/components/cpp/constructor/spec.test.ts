/**
 * `cpp:constructor` 的**自證測**（476，2026-11-15）——類別裡寫完整的建構子。
 *
 * ```
 * ① explicit／constexpr／noexcept 各是一格屬性（`noexcept(條件)` 照實降級）——原本 lift 把它們安靜地丟掉（`explicit P(int)` 來回一趟多了隱含轉換）
 * ② 來回一趟（程式碼、積木）一字不差
 * ③ 執行（Cella）：explicit 送 mbCtor.expl；constexpr 等 Cella 的 mbCtor.constexpr（第五輪）
 * ```
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { setupTestRenderer } from '../../../../tests/helpers/setup-renderer'
import { expectCellaOut, runCella, describeCellaResult } from '../../../../tests/helpers/cella-run'
import { formalize } from '../../../providers/cella/formalize'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { generateCode } from '../../../core/projection/code-generator'
import { renderToBlocklyState } from '../../../core/projection/block-renderer'
import { PatternExtractor } from '../../../core/projection/pattern-extractor'
import { BlockSpecRegistry } from '../../../core/blocks/block-spec-registry'
import { allCppComponents, allCppProjections } from '../../../languages/cpp/all-declarations'
import { registerCppExtractStrategies } from '../../../languages/cpp/extractors/extract-strategies'
import apcs from '../../../languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../../core/types'

const S = apcs as unknown as StylePreset
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
const lift = (c: string): SemanticNode => createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode
const all = (n: SemanticNode, o: SemanticNode[] = []): SemanticNode[] => { o.push(n); for (const k of Object.values(n.slots ?? {})) for (const c of k) all(c, o); return o }
const ctors = (t: SemanticNode) => all(t).filter((n) => n.componentId === 'cpp:constructor')
const gen = (t: SemanticNode) => generateCode(t, 'cpp', S)
function viaBlocks(t: SemanticNode): string {
  const state = renderToBlocklyState(t) as unknown as { blocks: { blocks: { next?: { block: unknown } }[] } }
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
const SRC = `${head}struct P {
    int v;
    constexpr P(int x) : v(x) {
    }
    explicit P(char c) : v(c) {
    }
    explicit constexpr P(long w) : v(w) {
    }
    P() noexcept : v(0) {
    }
};
int main() {
    P a(3);
    P b('A');
    P c(7L);
    P d;
    cout << a.v << " " << b.v << " " << c.v << " " << d.v << endl;
    return 0;
}
`

describe('cpp:constructor', () => {
  it('★ lift：explicit／constexpr／noexcept 各記一格屬性', () => {
    const cs = ctors(lift(SRC))
    expect(cs.length).toBe(4)
    expect(cs.map((n) => [n.properties.is_explicit, n.properties.is_constexpr, n.properties.is_noexcept])).toEqual([
      ['false', 'true', 'false'], ['true', 'false', 'false'], ['true', 'true', 'false'], ['false', 'false', 'true'],
    ])
  })
  it('★ generate：一字不差（修飾不再被丟掉）', () => {
    expect(gen(lift(SRC)).trimEnd()).toBe(SRC.trimEnd())
  })
  it('★ 走一趟積木回來：修飾還在', () => {
    const out = viaBlocks(lift(SRC))
    expect(out).toContain('constexpr P(int x) : v(x) {')
    expect(out).toContain('explicit P(char c) : v(c) {')
    expect(out).toContain('explicit constexpr P(long w) : v(w) {')
    expect(out).toContain('    P() noexcept : v(0) {')
  })
  it('★ 積木：三個下拉選單照屬性', () => {
    const text = JSON.stringify(renderToBlocklyState(lift(SRC)))
    expect(text).toContain('"IS_EXPLICIT":"true"')
    expect(text).toContain('"IS_CONSTEXPR":"true"')
    expect(text).toContain('"IS_NOEXCEPT":"true"')
  })
  it('★ 執行（Cella）：輸出相同', async () => {
    await expectCellaOut(SRC, '3 65 7 0\n')
  })
  it('★ formalize：constexpr 送 mbCtor.constexpr（Cella 第五輪，484 接上）', () => {
    const json = JSON.stringify(formalize(lift(SRC)))
    const flags = [...json.matchAll(/"expl":(true|false),"constexpr":(true|false)/g)].map((m) => [m[1], m[2]])
    expect(flags).toEqual([['false', 'true'], ['true', 'false'], ['true', 'true'], ['false', 'false']])
  })
  it('★ 執行（Cella）：explicit 送出去了——複製初始化用不了 explicit 建構子，Cella 判 reject', async () => {
    const bad = `${head}struct Q {\n    int v;\n    explicit Q(int x) : v(x) {\n    }\n};\nint main() {\n    Q q = 5;\n    cout << q.v << endl;\n    return 0;\n}\n`
    expect(ctors(lift(bad))[0].properties.is_explicit).toBe('true')
    const r = await runCella(bad)
    expect(r.verdict, describeCellaResult(r)).toBe('reject')
    expect(describeCellaResult(r)).toMatch(/no viable conversion/)
  })
  it('負向：noexcept(條件) 沒有地方放那個條件——照實降級、原文一字不差', () => {
    const src = 'struct R {\n    int v;\n    R(int x) noexcept(true) : v(x) {\n    }\n};\n'
    const t = lift(src)
    expect(all(t).some((n) => n.componentId === 'cpp:struct_declare' || n.componentId === 'raw_code')).toBe(true)
    expect(ctors(t).length).toBe(0)
    expect(gen(t)).toContain('R(int x) noexcept(true) : v(x)')
  })
  // 🟢 原本是已知缺陷（Cella，11-15 回報：例外穿過 noexcept 建構子被 catch 接到，g++ 會 terminate）；Cella 0.1.202611152334 修好，484 拔釘子
  it('🟢 Cella 2334 起修好：noexcept 的建構子丟出例外就 terminate，catch 接不到', async () => {
    const src = `${head}struct T {\n    int v;\n    T(int x) noexcept : v(x) {\n        if (x < 0) {\n            throw 1;\n        }\n    }\n};\nint main() {\n    try {\n        T t(-1);\n        cout << t.v << endl;\n    } catch (int e) {\n        cout << "caught" << endl;\n    }\n    return 0;\n}\n`
    expect(ctors(lift(src))[0].properties.is_noexcept).toBe('true')
    {
      const r = await runCella(src)
      // 判 accept 而且什麼都沒印——terminate 發生在 cout 之前（unknown／reject 不算過）
      expect(r.verdict, describeCellaResult(r)).toBe('accept')
      expect(r.out ?? '', describeCellaResult(r)).toBe('')
    }
  })
})
