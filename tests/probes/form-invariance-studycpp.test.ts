/**
 * **探針：換形態，判決不變——學生語料**（spec 213；`STUDYCPP_DIR` 才跑）。
 *
 * 與 `tests/integration/form-invariance` 同一套三種轉換（同風格來回、只改格式的風格切換、積木來回），母體換成學生的 218 支：
 * 課文是我們寫的，學生的寫法更雜。報出每一種轉換的「相同／不同／原本就翻不出」，與不同的那幾支差在哪。
 *
 * ```bash
 * STUDYCPP_DIR=/path/to/StudyCpp npx vitest run tests/probes/form-invariance-studycpp.test.ts
 * ```
 * ⚠️ 先 `find $STUDYCPP_DIR -name "*.cpp" | wc -l`——不是 218 就重新 clone（`/private/tmp` 會被系統清掉，CLAUDE.md）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import * as Blockly from 'blockly'
import { registerFieldMultilineInput } from '@blockly/field-multilineinput'
import { createTestLifter } from '../helpers/setup-lifter'
import { normalizeFormal, firstDifference } from '../helpers/normalize-formal'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { formalize } from '../../src/providers/cella/formalize'
import '../../src/languages/cpp/pack'
import { languagePack } from '../../src/core/language-packs'
import { registerDynamicDropdownField, declareDropdownSource } from '../../src/ui/dynamic-dropdown-field'
import { BlockSpecRegistry } from '../../src/core/blocks/block-spec-registry'
import { allCppProjections } from '../../src/languages/cpp/all-declarations'
import { allComponentDefs } from '../helpers/component-scan'
import { componentLabels } from '../../src/core/component/labels'
import i18nBlocks from '../../src/i18n/zh-TW/blocks.json'
import { PatternRenderer } from '../../src/core/projection/pattern-renderer'
import { RenderStrategyRegistry } from '../../src/core/registry'
import { registerCppRenderStrategies } from '../../src/languages/cpp/renderers/strategies'
import { renderToBlocklyState, setPatternRenderer } from '../../src/core/projection/block-renderer'
import { setDegradationLanguage } from '../../src/core/blocks/degradation-blocks'
import { PatternExtractor } from '../../src/core/projection/pattern-extractor'
import { registerCppExtractStrategies } from '../../src/languages/cpp/extractors/extract-strategies'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import google from '../../src/languages/cpp/styles/google.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

const DIR = process.env.STUDYCPP_DIR ?? ''
const S = (x: unknown) => x as StylePreset

describe.skipIf(!DIR)('探針：換形態，判決不變（學生語料）', () => {
  let parser: Parser
  let extractor: PatternExtractor
  let shaping: { autoIncludeNodes: (t: SemanticNode, ns: 'using' | 'explicit', styleId: string) => SemanticNode[] }
  beforeAll(async () => {
    await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
    parser = new Parser()
    parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
    registerCppLanguage()
    shaping = languagePack('cpp')!.createCodeShaping!() as never
    registerFieldMultilineInput()
    registerDynamicDropdownField()
    for (const k of ['names', 'vars', 'funcs', 'arrays', 'cpp_var_types', 'cpp_param_types', 'cpp_return_types', 'python_types']) declareDropdownSource(k, () => [])
    const reg = new BlockSpecRegistry()
    reg.loadFromSplit(allComponentDefs(), allCppProjections())
    const ws = new Blockly.Workspace()
    Object.assign(Blockly.Msg as Record<string, string>, i18nBlocks, componentLabels('zh-TW'))
    const { BlockRegistrar } = await import('../../src/ui/block-registrar')
    new BlockRegistrar(reg).registerAll({ getWorkspace: () => ws })
    const rsr = new RenderStrategyRegistry()
    registerCppRenderStrategies(rsr)
    const renderer = new PatternRenderer()
    renderer.setRenderStrategyRegistry(rsr)
    renderer.loadBlockSpecs(reg.getAll())
    setPatternRenderer(renderer)
    setDegradationLanguage('cpp')
    extractor = new PatternExtractor()
    extractor.loadBlockSpecs(reg.getAll())
    registerCppExtractStrategies(extractor)
  }, 180_000)

  it('三種轉換的相同／不同', () => {
    const files: string[] = []
    const walk = (d: string): void => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (f.endsWith('.cpp')) files.push(f) } }
    walk(DIR)
    expect(files.length, '🔴 學生語料不是 218 支——/private/tmp 被清過？重新 clone').toBe(218)
    const lift = (code: string): SemanticNode => createTestLifter().lift(parser.parse(code)!.rootNode as never) as SemanticNode
    const formal = (t: SemanticNode, style: StylePreset): unknown => {
      const shown = { ...t, slots: { ...t.slots, body: [...shaping.autoIncludeNodes(t, style.namespace_style as 'using' | 'explicit', style.id), ...(t.slots.body ?? [])] } }
      const f = formalize(shown, {})
      return f.program ? normalizeFormal(f.program) : { untranslated: (f.unknown ?? []).map((u: { construct: string; reason: string }) => `${u.construct}：${u.reason}`) }
    }
    const dropStd = (v: unknown): unknown => Array.isArray(v) ? v.filter((x) => !(x && typeof x === 'object' && (x as { k?: string }).k === 'iUsing')).map(dropStd)
      : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, dropStd(x)])) : typeof v === 'string' ? v.replace(/^std::/, '') : v
    const chainOf = (b0: unknown): SemanticNode[] => { const acc: SemanticNode[] = []; let cur = b0 as { next?: { block: unknown } } | undefined; while (cur) { const n = extractor.extract(cur as never); if (n) acc.push(n); cur = (cur.next?.block ?? undefined) as typeof cur } return acc }
    const tally = { a: { same: 0, diff: 0 }, b: { same: 0, diff: 0 }, c: { same: 0, diff: 0 }, untranslated: 0 }
    const diffs: string[] = []
    for (const f of files.sort()) {
      const id = path.relative(DIR, f)
      const tree = lift(fs.readFileSync(f, 'utf8'))
      const base = formal(tree, S(apcs))
      if ((base as { untranslated?: unknown }).untranslated) { tally.untranslated++; continue }
      const check = (k: 'a' | 'b' | 'c', after: unknown, ns = false) => {
        const d = ns ? firstDifference(dropStd(base), dropStd(after)) : firstDifference(base, after)
        const gone = (after as { untranslated?: string[] }).untranslated
        if (gone) { tally[k].diff++; diffs.push(`(${k}) ${id}｜轉換後翻不出：${gone.join('；').slice(0, 160)}`) } else if (d) { tally[k].diff++; diffs.push(`(${k}) ${id}｜${d}`) } else tally[k].same++
      }
      try { check('a', formal(lift(generateCode(tree, 'cpp', S(apcs))), S(apcs))) } catch (e) { tally.a.diff++; diffs.push(`(a) ${id}｜丟例外 ${String(e).slice(0, 60)}`) }
      try { check('b', formal(lift(generateCode(tree, 'cpp', S(google))), S(google)), true) } catch (e) { tally.b.diff++; diffs.push(`(b) ${id}｜丟例外 ${String(e).slice(0, 60)}`) }
      try {
        const { blockMappings: _drop, ...state } = renderToBlocklyState(tree)
        check('c', formal({ ...tree, slots: { ...tree.slots, body: (state.blocks.blocks as unknown[]).flatMap(chainOf) } }, S(apcs)))
      } catch (e) { tally.c.diff++; diffs.push(`(c) ${id}｜丟例外 ${String(e).slice(0, 60)}`) }
    }
    console.log([`換形態，判決不變（學生語料 ${files.length} 支；原本就翻不出 ${tally.untranslated}）`,
      `  (a) 同風格來回  相同 ${tally.a.same}｜不同 ${tally.a.diff}`,
      `  (b) 格式風格切換 相同 ${tally.b.same}｜不同 ${tally.b.diff}`,
      `  (c) 積木來回    相同 ${tally.c.same}｜不同 ${tally.c.diff}`, ...diffs.slice(0, 80)].join('\n'))
  }, 1_800_000)
})
