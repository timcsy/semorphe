/**
 * **union 盲測回歸**（元件管線 345，2026-11-08；component-fuzz：出題的代理不知道我們的實作，8 支在 `tests/fixtures/fuzz-cpp-union.json`，
 * `out` 是當時 gcc／g++ 印的）。報告 `tests/reports/fuzz-cpp-union-20261108.md`。
 *
 * 每一支量：lift → 產碼（含 auto-include 修補）→ 再 lift 同一棵；走一趟積木產碼同一棵；原文與產出交給 Cella 的結果相同。
 * 抓到的兩個靜默改寫各一條精確斷言（修之前產出的程式編不過）。
 * ⚠️ 不呼叫 gcc：npm test 的判準只剩 Cella（6c-5）。盲測當時對過 gcc：修之後 8 支產出與走積木的程式輸出都和原文相同。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { setupTestRenderer } from '../helpers/setup-renderer'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode, setDependencyResolver } from '../../src/core/projection/code-generator'
import { renderToBlocklyState } from '../../src/core/projection/block-renderer'
import { PatternExtractor } from '../../src/core/projection/pattern-extractor'
import { BlockSpecRegistry } from '../../src/core/blocks/block-spec-registry'
import { allCppComponents, allCppProjections } from '../../src/languages/cpp/all-declarations'
import { registerCppExtractStrategies } from '../../src/languages/cpp/extractors/extract-strategies'
import { createPopulatedRegistry } from '../../src/languages/cpp/std'
import { createCppCodePatcher } from '../../src/languages/cpp/auto-include'
import { runCella } from '../helpers/cella-run'
import cStyle from '../../src/languages/cpp/styles/c.json'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

interface Prog { id: string; lang: 'c' | 'cpp'; description: string; code: string; out: string }
const progs: Prog[] = JSON.parse(fs.readFileSync('tests/fixtures/fuzz-cpp-union.json', 'utf8'))

let parser: Parser
let ex: PatternExtractor
let patch: ReturnType<typeof createCppCodePatcher>
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
  const deps = createPopulatedRegistry()
  setDependencyResolver(deps as never)
  patch = createCppCodePatcher(deps as never)
})

const lift = (src: string): SemanticNode => createTestLifter().lift(parser.parse(src)!.rootNode as never) as SemanticNode
const styleOf = (p: Prog): StylePreset => (p.lang === 'c' ? cStyle : apcs) as StylePreset
const gen = (t: SemanticNode, p: Prog): string => { const g = generateCode(t, 'cpp', styleOf(p)); return patch(g, t, 'explicit', 2, 'main', p.lang) ?? g }
const shape = (n: SemanticNode): unknown => [n.componentId, n.properties, Object.entries(n.slots ?? {}).map(([k, v]) => [k, v.map(shape)])]
const ids = (n: SemanticNode, acc: string[] = []): string[] => { acc.push(n.componentId); Object.values(n.slots ?? {}).flat().forEach((c) => ids(c, acc)); return acc }
const byId = (id: string): Prog => progs.find((p) => p.id === id)!

describe('union 盲測：每一支來回不走樣、走積木不走樣、交給 Cella 的結果相同', () => {
  it('入口：讀到 8 支', () => expect(progs.length).toBe(8))
  for (const p of progs) {
    it(`${p.id}：${p.description.slice(0, 40)}`, async () => {
      const t = lift(p.code)
      expect(ids(t)).toContain('cpp:func_def')
      const out = gen(t, p)
      expect(JSON.stringify(shape(lift(out))), `走樣：\n${out}`).toBe(JSON.stringify(shape(t)))
      const state = renderToBlocklyState(t) as { blocks: { blocks: unknown[] } }
      const back = state.blocks.blocks.flatMap((b) => ex.extractStatementChain(b as never))
      const viaBlocks = gen({ id: 'root', componentId: 'cpp:program', properties: {}, slots: { body: back } } as SemanticNode, p)
      expect(JSON.stringify(shape(lift(viaBlocks))), `走一趟積木走樣：\n${viaBlocks}`).toBe(JSON.stringify(shape(t)))
      const a = await runCella(p.code, { lang: p.lang })
      const b = await runCella(out, { lang: p.lang })
      expect([b.verdict, b.out], `原文 ${a.verdict}／產出 ${b.verdict}\n${out}`).toEqual([a.verdict, a.out])
    }, 120_000)
  }
})

describe('union 盲測抓到的靜默改寫——每個一條', () => {
  it('🔴 `case X: { int b = …; }` 的大括號是作用域——曾經被展平，兩個 case 各宣告一次 `int b`，產出的程式編不過（fuzz_6）', () => {
    const out = gen(lift(byId('fuzz_6').code), byId('fuzz_6'))
    expect(out).toMatch(/case OP_ADD:\s*\{\s*int b = stack\[--sp\];/)
    expect(out).toMatch(/case OP_MUL:\s*\{\s*int b = stack\[--sp\];/)
  })
  it('🔴 結構裡的匿名 union 成員照原文降級——曾經被編上名字 `x`（`union {…} x;`），`p.code` 從此不存在（fuzz_8）', () => {
    const t = lift(byId('fuzz_8').code)
    const out = gen(t, byId('fuzz_8'))
    expect(out).toContain('    union {\n        int code;\n        char flag;\n    };')
    expect(out).not.toMatch(/\}\s*x;/)
  })
  it('有名字的成員、型別是匿名 union（`union { … } v;`）：形狀不走樣，formalize 照實翻不出（fuzz_1）', async () => {
    const out = gen(lift(byId('fuzz_1').code), byId('fuzz_1'))
    expect(out).toContain('    } v;')
    const r = await runCella(byId('fuzz_1').code, { lang: 'c' })
    expect(r.verdict).toBe('untranslated')
  }, 120_000)
})
