/**
 * 完備性護欄（US2）
 *
 * 分辨「做完了」與「看起來做完了」。
 *
 * 這是 P2「缺任一條路徑 = coverage gap = 架構缺陷（**0 容忍**）」的執行機構。
 * 那條原則寫在 principles.md、概念代數也定義了 ∀concept 五路，但在本護欄
 * 之前**沒有任何測試在檢查它**——原則本身是殼。
 *
 * ⚠️ 本護欄**不檢測「條件性正確」**（單獨測通過、組合時失敗）。它跑的
 * 最小樣本，就是那個會過的簡單情形。別讓它的綠燈製造安全感。
 *
 * 見 specs/049-audit-guardrails/spec.md（US2）、research.md D6
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import {
  loadBaseline,
  writeBaseline,
  printReport,
  writeReport,
  newItems,
  RATCHET_NOTE,
  type BaselineMeta,
} from '../helpers/guardrail'
import { allComponentDefs } from '../helpers/component-scan'
import { synthMinimalNode, isPlaceholderOutput, isNoopExecutor } from '../helpers/synth-node'
import { createTestLifter } from '../helpers/setup-lifter'
import { setupTestRenderer } from '../helpers/setup-renderer'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode, setTemplateGenerator } from '../../src/core/projection/code-generator'
import { TemplateGenerator } from '../../src/core/projection/template-generator'
import universalTemplatesJson from '../../src/languages/cpp/templates/universal-templates.json'
import { PatternRenderer } from '../../src/core/projection/pattern-renderer'
import { PatternExtractor } from '../../src/core/projection/pattern-extractor'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { RenderStrategyRegistry } from '../../src/core/registry'
import { registerCppRenderStrategies } from '../../src/languages/cpp/renderers/strategies'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import universalBlocks from '../../src/blocks/projections/blocks/universal-blocks.json'
import { coreBlocks } from '../../src/languages/cpp/core'
import { allStdModules } from '../../src/languages/cpp/std'
import { createNode } from '../../src/core/semantic-tree'
import type { Lifter } from '../../src/core/lift/lifter'
import type {
  UniversalTemplate,
  ConceptDefJSON,
  BlockProjectionJSON,
  SemanticNode,
  PathName,
  StylePreset,
} from '../../src/core/types'

const DISCLAIMER =
  '⚠️ 本護欄只抓「殼」（路徑存在但退化）。它**不檢測條件性正確**——' +
  '單獨測通過、組合起來才壞的問題（例如 lift pattern 遞迴深度不足），' +
  '由 fuzz 等組合式測試負責。綠燈 ≠ 完備。'

/** 宣告這條路的失效樣態——照 knowledge/concepts/執行機構.md 的要求 */
const DECLARATION_WARNING =
  '⚠️ **📄 的數字上升不是進步。** 宣告會讓 🈳 下降而系統一點都沒變。' +
  '如果 📄 大幅成長而 ✅ 沒動，多半是有人用宣告刷數字——' +
  '每一個 📄 都必須通過 `tests/integration/skip-declaration-gate.test.ts` 的門檻，' +
  '而那份門檻的依據是實測（specs/053-declare-noop-execute/classification.md）。' +
  '實測 34 個候選裡只有 12 個站得住；**若哪天 📄 逼近 34，那是判準壞了，不是我們變好了**。'

const RULE =
  '從 ConceptDef 合成最小節點跑一圈五路。' +
  'missing = 路徑不存在；shell = 路徑存在但輸出退化（空／佔位／身分不符／未宣告的空操作）。'

/**
 * `declared` 與 `implemented` **必須分開**。
 *
 * 兩種下降看起來一樣，意義完全不同：
 *   因為**實作**了 → 系統多會做一件事
 *   因為**宣告**了 → 系統沒有變，只是我們終於說清楚它本來就不做
 *
 * 混在一起的話，下一個人會用宣告刷數字，而護欄會替他背書。
 */
type Verdict = 'implemented' | 'declared' | 'undecidable' | 'shell' | 'missing'
const PATHS: PathName[] = ['generate', 'lift', 'render', 'extract', 'execute']

interface PathResult {
  verdict: Verdict
  reason?: string
}
type Row = Record<PathName, PathResult>

interface CompletenessBaseline {
  _meta: BaselineMeta
  totals: { implemented: number; declared: number; undecidable: number; shell: number; missing: number }
  shells: { componentId: string; path: PathName }[]
  missing: { componentId: string; path: PathName }[]
}

let lifter: Lifter
let tsParser: Parser
let interp: SemanticInterpreter
let renderer: PatternRenderer
let extractor: PatternExtractor
let specsCache: ReturnType<BlockSpecRegistry['getAll']> = []
const STYLE: StylePreset = { id: 'default' } as unknown as StylePreset

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
  setupTestRenderer()
  interp = new SemanticInterpreter()

  // render／extract 直接用 PatternRenderer／PatternExtractor：
  // renderToBlocklyState 需要 program 外殼且只處理 statement，
  // 用它會讓所有 expression 元件無故判為殼。
  const reg = new BlockSpecRegistry()
  reg.loadFromSplit(
    allComponentDefs(),
    [
      ...(universalBlocks as unknown as BlockProjectionJSON[]),
      ...coreBlocks,
      ...allStdModules.flatMap((m) => m.blocks),
    ],
  )
  const specs = reg.getAll()
  specsCache = specs
  const rsr = new RenderStrategyRegistry()
  registerCppRenderStrategies(rsr)
  renderer = new PatternRenderer()
  renderer.setRenderStrategyRegistry(rsr)
  renderer.loadBlockSpecs(specs)
  extractor = new PatternExtractor()
  extractor.loadBlockSpecs(specs)
}, 60_000)

/** 把節點包成可生成的程式（多數 generator 需要 program 外殼） */
function wrap(node: SemanticNode): SemanticNode {
  return createNode('program', {}, { body: [node] })
}

function findConcept(node: SemanticNode | null, id: string): boolean {
  if (!node) return false
  if (node.concept === id) return true
  return Object.values(node.children ?? {}).some((arr) => arr.some((c) => findConcept(c, id)))
}

function classify(def: ConceptDefJSON): { row: Row; generated: string } {
  const id = def.conceptId
  const skip = new Set<PathName>(def.skipPaths ?? [])
  const { node } = synthMinimalNode(def)
  const row = {} as Row
  let generated = ''

  const declared = (p: PathName): PathResult | null =>
    skip.has(p)
      ? {
          verdict: 'declared',
          reason: `已宣告刻意不提供（${def.skipReasons?.[p] ?? '未寫理由'}）`,
        }
      : null

  // ── generate ─────────────────────────────────────────────────────────
  row.generate =
    declared('generate') ??
    (() => {
      try {
        generated = generateCode(wrap(node), 'cpp', STYLE)
        const own = generated
          .split('\n')
          .filter((l) => !/^\s*(#include|using |int main|\}|\{|return 0;)/.test(l))
          .join('\n')
        if (isPlaceholderOutput(own)) return { verdict: 'shell', reason: '輸出為空或佔位' } as PathResult
        if (/\braw_code\b|\bunresolved\b/.test(own))
          return { verdict: 'shell', reason: '退化成 raw_code／unresolved' } as PathResult
        return { verdict: 'implemented' } as PathResult
      } catch (e) {
        return { verdict: 'shell', reason: `擲出例外：${(e as Error).message.slice(0, 60)}` } as PathResult
      }
    })()

  // ── lift（輸入來自 generate 的輸出）────────────────────────────────────
  row.lift =
    declared('lift') ??
    (() => {
      if (row.generate.verdict !== 'implemented')
        return { verdict: 'missing', reason: 'generate 未產出可解析的程式碼' } as PathResult
      try {
        const tree = tsParser.parse(generated)
        // 樣本本身就不是合法的 C++ → 這一列**判不出來**，不是殼。
        //
        // `case 1:` 脫離 switch、`case`／`default` 這類概念本來就不能單獨成立。
        // 把它算成「lift 是殼」是在怪 lift 沒辦到一件不可能的事——而那會讓
        // 「殼」這個數字灌水，進而讓清償優先序指錯方向。
        const lifted = lifter.lift(tree.rootNode as never)
        if (!lifted) return { verdict: 'shell', reason: 'lift 回傳 null' } as PathResult
        if (findConcept(lifted, id)) return { verdict: 'implemented' } as PathResult
        // 身分沒找到——但樣本本身若不是合法的獨立程式，那是**樣本的問題**。
        //
        // `case 1:` 脫離 switch 就不合法；怪 lift 沒辦到不可能的事，會讓「殼」
        // 這個數字灌水，進而讓清償優先序指錯方向。
        // **只有樣本合法時，找不到身分才算殼。**
        if (tree.rootNode.hasError) {
          return {
            verdict: 'undecidable',
            reason: '合成樣本不是合法的獨立程式（此概念需要父節點才成立）',
          } as PathResult
        }
        if (findConcept(lifted, 'raw_code'))
          return { verdict: 'shell', reason: '降級成 raw_code' } as PathResult
        return { verdict: 'shell', reason: '回來的樹裡找不到原本的身分' } as PathResult
      } catch (e) {
        return { verdict: 'shell', reason: `擲出例外：${(e as Error).message.slice(0, 60)}` } as PathResult
      }
    })()

  // ── render ───────────────────────────────────────────────────────────
  let block: ReturnType<PatternRenderer['render']> = null
  row.render =
    declared('render') ??
    (() => {
      try {
        block = renderer.render(node)
        if (!block) return { verdict: 'missing', reason: '無 blockDef，render 回傳 null' } as PathResult
        return { verdict: 'implemented' } as PathResult
      } catch (e) {
        return { verdict: 'shell', reason: `擲出例外：${(e as Error).message.slice(0, 60)}` } as PathResult
      }
    })()

  // ── extract（輸入來自 render 的輸出）──────────────────────────────────
  row.extract =
    declared('extract') ??
    (() => {
      if (!block) return { verdict: 'missing', reason: 'render 未產出可還原的積木' } as PathResult
      try {
        const back = extractor.extract(block)
        if (!back) return { verdict: 'shell', reason: 'extract 回傳 null' } as PathResult
        if (back.concept !== id)
          return { verdict: 'shell', reason: `取回的身分是 ${back.concept}，不是 ${id}` } as PathResult
        return { verdict: 'implemented' } as PathResult
      } catch (e) {
        return { verdict: 'shell', reason: `擲出例外：${(e as Error).message.slice(0, 60)}` } as PathResult
      }
    })()

  // ── execute ──────────────────────────────────────────────────────────
  row.execute =
    declared('execute') ??
    (() => {
      const fn = interp.getExecutor(id)
      if (!fn) return { verdict: 'missing', reason: '無 executor 註冊' } as PathResult
      if (isNoopExecutor(fn))
        return { verdict: 'shell', reason: '空操作且未宣告 skipPaths' } as PathResult
      return { verdict: 'implemented' } as PathResult
    })()

  return { row, generated }
}

function measure(): Map<string, Row> {
  const out = new Map<string, Row>()
  for (const def of allComponentDefs()) {
    if (out.has(def.conceptId)) continue
    out.set(def.conceptId, classify(def).row)
  }
  return out
}

/**
 * 兩種組態的 generate 差異（FR-023）
 *
 * **現行組態**：不接 TemplateGenerator——這是 app 的實際行為
 * （`setTemplateGenerator` 在 src/ 內零呼叫、`initCppModule()` 是死碼，見 research.md F2）。
 * **宣告組態**：接上載入 universal templates 與各 blockSpec `codeTemplate`
 * 的 TemplateGenerator——即 JSON 所宣告的樣子。
 *
 * 比對的是**產生的程式碼文字**，不是 verdict——verdict 粒度太粗，
 * 兩邊都產得出有效輸出時看不出差別，而真正的風險是「文字不同」。
 *
 * 差異 = 「JSON 宣告了、實際上沒被用」的那些。也就是：如果哪天把 template
 * 接回去，這些元件的輸出會變。
 */
function generatedUnderCurrentConfig(): Map<string, string> {
  const out = new Map<string, string>()
  for (const def of allComponentDefs()) {
    if (out.has(def.conceptId)) continue
    const { node } = synthMinimalNode(def)
    try {
      out.set(def.conceptId, generateCode(wrap(node), 'cpp', STYLE))
    } catch (e) {
      out.set(def.conceptId, `<<throw:${(e as Error).message.slice(0, 40)}>>`)
    }
  }
  return out
}

function measureConfigDelta(): { componentId: string; actual: string; declared: string }[] {
  const actual = generatedUnderCurrentConfig()

  const tg = new TemplateGenerator()
  tg.loadUniversalTemplates(universalTemplatesJson as unknown as UniversalTemplate[])
  for (const spec of specsCache) {
    if (spec.codeTemplate?.pattern && spec.concept?.conceptId) {
      tg.registerTemplate(spec.concept.conceptId, spec.codeTemplate)
    }
  }
  setTemplateGenerator(tg)
  const declared = generatedUnderCurrentConfig()
  setTemplateGenerator(null as never)

  const out: { componentId: string; actual: string; declared: string }[] = []
  for (const [id, a] of actual) {
    const d = declared.get(id) ?? ''
    if (a.trim() !== d.trim()) out.push({ componentId: id, actual: a.trim(), declared: d.trim() })
  }
  return out.sort((x, y) => x.componentId.localeCompare(y.componentId))
}

const flatten = (m: Map<string, Row>, v: Verdict): { componentId: string; path: PathName }[] =>
  [...m].flatMap(([componentId, row]) =>
    PATHS.filter((p) => row[p].verdict === v).map((path) => ({ componentId, path })),
  )

const key = (x: { componentId: string; path: PathName }): string => `${x.componentId}::${x.path}`

describe('護欄：完備性（五路是實作／殼／缺）', () => {
  let result: Map<string, Row>

  beforeAll(() => {
    result = measure()
  })

  it('產出補完地圖，涵蓋全部元件（SC-003）', () => {
    const total = result.size
    const shells = flatten(result, 'shell')
    const missing = flatten(result, 'missing')
    const impl = flatten(result, 'implemented')
    const declared = flatten(result, 'declared')
    const undecidable = flatten(result, 'undecidable')

    const md: string[] = []
    md.push('# 補完地圖（自動產生，勿手改）')
    md.push('')
    md.push(`> ${DISCLAIMER}`)
    md.push('>')
    md.push(`> ${DECLARATION_WARNING}`)
    md.push('')
    md.push(`判定規則：${RULE}`)
    md.push('')
    md.push(
      `元件：${total}｜✅ 實作 ${impl.length}｜📄 已宣告不提供 ${declared.length}｜` +
        `❔ 判不出來 ${undecidable.length}｜🈳 殼 ${shells.length}｜❌ 缺 ${missing.length}（以路徑數計）`,
    )
    md.push('')
    md.push(
      '> **「已宣告不提供」與「實作」是兩件事。** 前者代表系統沒有變，只是我們終於說清楚它本來就不做；' +
        '後者代表系統多會做一件事。混在同一個數字裡的話，用宣告刷數字看起來會像進步。' +
        '棘輪只看 🈳 與 ❌。',
    )
    md.push('')
    md.push('| 元件 | generate | lift | render | extract | execute |')
    md.push('|---|---|---|---|---|---|')
    const icon = (v: Verdict): string =>
      v === 'implemented' ? '✅' : v === 'declared' ? '📄' : v === 'undecidable' ? '❔' : v === 'shell' ? '🈳' : '❌'
    for (const [id, row] of [...result].sort(([a], [b]) => a.localeCompare(b))) {
      md.push(`| \`${id}\` | ${PATHS.map((p) => icon(row[p].verdict)).join(' | ')} |`)
    }
    writeReport('tests/reports/completeness-map.md', md.join('\n') + '\n')

    // 殼的**原因**分佈——36 個 lift 殼若多數是同一個根因，那是一個問題不是 36 個
    const reasonCount = new Map<string, string[]>()
    for (const [id, row] of result) {
      for (const p of PATHS) {
        if (row[p].verdict !== 'shell') continue
        const key = `${p}｜${row[p].reason ?? '（無原因）'}`
        const arr = reasonCount.get(key) ?? []
        arr.push(id)
        reasonCount.set(key, arr)
      }
    }
    const REASON_SUMMARY = [...reasonCount.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([k, ids]) => `  ${ids.length.toString().padStart(3)} 個  ${k}\n         ${ids.slice(0, 8).join('、')}${ids.length > 8 ? ' …' : ''}`)

    printReport('完備性護欄', [
      DISCLAIMER,
      DECLARATION_WARNING,
      '',
      `判定規則：${RULE}`,
      '',
      `元件：${total}｜✅ ${impl.length}｜📄 已宣告 ${declared.length}｜❔ 判不出來 ${undecidable.length}｜🈳 ${shells.length}｜❌ ${missing.length}（路徑數）`,
      '',
      '**❔ 判不出來 ≠ 沒問題。** 那是合成樣本本身不合法（概念需要父節點才成立），',
      '所以這一列量不到東西——把它算成「實作了」是為了讓數字好看，算成「殼」是',
      '怪 lift 沒辦到不可能的事。它需要的是**更好的樣本**，不是修 lift。',
      '',
      '📄 的理由（宣告要可複查，不是一次性的）：',
      ...(() => {
        const byReason = new Map<string, string[]>()
        for (const d of declared) {
          const r = result.get(d.componentId)?.[d.path]?.reason ?? '（未寫理由）'
          const arr = byReason.get(r) ?? []
          arr.push(`${d.componentId}.${d.path}`)
          byReason.set(r, arr)
        }
        return [...byReason].map(([r, ids]) => `  ${r}：${ids.join('、')}`)
      })(),
      '',
      '**殼的原因分佈**（同一個根因造成的多個殼，是一個問題不是多個）：',
      ...REASON_SUMMARY,
      '',
      '殼最多的路徑：',
      ...PATHS.map((p) => `  ${p.padEnd(9)} 殼 ${shells.filter((s) => s.path === p).length} ｜ 缺 ${missing.filter((s) => s.path === p).length}`),
      '',
      '補完地圖：tests/reports/completeness-map.md',
    ])

    const delta = measureConfigDelta()
    printReport('完備性：兩組態差異（FR-023）', [
      '現行組態 = app 的實際行為（不接 TemplateGenerator）',
      '宣告組態 = JSON 所宣告的樣子（接上 TemplateGenerator）',
      '',
      delta.length === 0
        ? '（無差異——若這裡是空的，多半是護欄沒接對，見 research.md F2／F3）'
        : `${delta.length} 個元件在兩種組態下的 generate 判定不同：`,
      ...delta.slice(0, 20).map((d) => {
        const one = (t: string): string => t.split('\n').filter((l) => !/^\s*(#include|using |int main|\}|return 0;)/.test(l) && l.trim()).join(' ⏎ ').slice(0, 70)
        return `  ${d.componentId}\n      現行: ${one(d.actual)}\n      宣告: ${one(d.declared)}`
      }),
      ...(delta.length > 25 ? [`  … 另外 ${delta.length - 25} 個`] : []),
    ])

    expect(result.size).toBe(new Set(allComponentDefs().map((d) => d.conceptId)).size)
  })

  it('數字不為零——零代表沒有真的量到東西（SC-001）', () => {
    expect(flatten(result, 'shell').length + flatten(result, 'missing').length).toBeGreaterThan(0)
  })

  it('棘輪：殼與缺不得出現基線之外的新項目（FR-003、FR-005）', () => {
    const baseline = loadBaseline<CompletenessBaseline>('completeness')
    const addedShells = newItems(flatten(result, 'shell'), baseline.shells, key)
    const addedMissing = newItems(flatten(result, 'missing'), baseline.missing, key)

    if (addedShells.length + addedMissing.length > 0) {
      printReport('完備性：偵測到新的殼／缺', [
        ...addedShells.map((x) => `  ✘ 新殼  ${x.componentId} → ${x.path}`),
        ...addedMissing.map((x) => `  ✘ 新缺  ${x.componentId} → ${x.path}`),
      ])
    }
    expect([...addedShells, ...addedMissing].map(key)).toEqual([])
  })
})

/** 產生基線：`GENERATE_BASELINE=1 npx vitest run tests/integration/audit-completeness.test.ts` */
if (process.env.GENERATE_BASELINE) {
  // vitest 的 beforeAll 尚未跑，所以另開一支測試來產生
  describe('產生基線', () => {
    it('write', () => {
      const m = measure()
      const shells = flatten(m, 'shell')
      const missing = flatten(m, 'missing')
      writeBaseline('completeness', {
        _meta: {
          guard: 'completeness',
          measuredAt: new Date().toISOString().slice(0, 10),
          rule: RULE,
          note: RATCHET_NOTE + ' ' + DISCLAIMER,
        },
        totals: {
          implemented: flatten(m, 'implemented').length,
          declared: flatten(m, 'declared').length,
          undecidable: flatten(m, 'undecidable').length,
          shell: shells.length,
          missing: missing.length,
        },
        shells: shells.sort((a, b) => key(a).localeCompare(key(b))),
        missing: missing.sort((a, b) => key(a).localeCompare(key(b))),
      })
      expect(true).toBe(true)
    })
  })
}
