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
import { skipReason } from '../../src/core/skip-declarations'
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
import { universalBlocks } from '../../src/blocks/universal'
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
import apcsPreset from '../../src/languages/cpp/styles/apcs.json'

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
/**
 * **用真的風格預設，不要造一個假的。**
 *
 * 原本這裡是 `{ id: 'default' }`——一個不存在的風格。於是 `io_style` 是
 * undefined，產生器走了非預期的分支：`print` 產生 `printf(...)`、`input`
 * 產生 `scanf(...)`，再辨識回來自然變成 `cpp_printf`／`cpp_scanf`。
 *
 * **那被記錄成「概念身分在 round-trip 後改變」的已知缺陷，而它其實不存在**
 * ——換成真的 apcs（`io_style: "cout"`，也是應用程式的預設）之後，
 * `print` 與 `input` 都完整守住身分。
 *
 * 教訓：合成測試的**環境**也要真實，不只輸入要真實。
 * 見 specs/057、`knowledge/experience.md`「量測工具的第一版會安靜地量錯」
 */
const STYLE = apcsPreset as unknown as StylePreset

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
      ...(universalBlocks),
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
/**
 * 概念身分 → 它需要的**前置宣告**。
 *
 * ⚠️ **合成的樣本要提供概念需要的脈絡，否則量到的是別的東西。**
 *
 * `x.clear()` 沒有宣告時，辨識器查不到型別，**正確地**退回通用容器版
 * ——那是保守設計在運作，不是缺陷。但完備性會把它記成「找不到原本的身分」。
 *
 * > 「合成測試的**環境**也要真實，不只輸入要真實。」——本檔既有的教訓，
 * > 而這是它的第二個實例。
 *
 * 型別由概念所屬的模組決定（`std/string` 的方法 → 那個物件是字串），
 * 不是猜的。
 */
const SAMPLE_CONTEXT: Record<string, SemanticNode[]> = {}
for (const id of ['cpp_string_clear', 'cpp_string_push_back', 'cpp_string_at', 'cpp_string_length', 'cpp_string_substr', 'cpp_string_find']) {
  SAMPLE_CONTEXT[id] = [createNode('cpp_string_declare', { name: 'x', type: 'string' }, {})]
}
// **第三個實例**（2026-08-07）：`mp[k]` 沒有 map 宣告時，辨識器查不到型別，
// **正確地**退回 `array_assign`／`array_access`——同一個保守設計。
// ⚠️ 脈絡宣告的變數名**必須與合成節點用的那個一致**。第一版用了 `mp`
// （產生器的預設值），而 `synth-node.ts` 給 `obj` 這類屬性的合成值是 `'x'`
// ——名字對不上，型別自然查不到，於是它仍然被判成殼。**脈絡有了、接不上，
// 與「機制有了沒人接上」同一個形狀。**
for (const id of ['cpp_map_access', 'cpp_map_assign']) {
  SAMPLE_CONTEXT[id] = [createNode('cpp_map_declare', { name: 'x', key_type: 'int', value_type: 'int' }, {})]
}

/**
 * ⚠️ **試過、失敗、還原：** 把角色是「運算式」的概念一律包進
 * `auto __probe = …` 再量。
 *
 * 想法是對的（`x.x()` 這種裸運算式當敘述放不成立），但**一律套用會改變太多
 * 概念的產出**——殼從 2 變成 13，而那 11 個原本是誠實的「判不出來」。
 *
 * **量測工具的改動也會讓量測變差，而那一樣要被發現。** 還原。
 * 要做的話得逐概念給脈絡（像上面的 `SAMPLE_CONTEXT`），不是按角色一刀切。
 */
/**
 * 這些概念的產出是**裸運算式**，當敘述放不成立——包進一個賦值。
 *
 * ⚠️ **逐概念列，不按角色一刀切。** 按角色套用試過：殼從 2 變成 13，
 * 而那 11 個原本是誠實的「判不出來」。逐概念的代價是要維護一份清單，
 * 而它的好處是**每一筆都可以單獨驗證有沒有讓判定變差**。
 */
const NEEDS_ASSIGNMENT = new Set(['cpp_method_call_expr', 'cpp_lambda'])

function wrap(node: SemanticNode | null, id?: string): SemanticNode {
  const prelude = id ? (SAMPLE_CONTEXT[id] ?? []) : []
  // `node` 為 null＝**只有鷹架**（差分的基準，見 generate 那一段）
  if (!node) return createNode('program', {}, { body: [...prelude] })
  const stmt =
    id && NEEDS_ASSIGNMENT.has(id)
      ? createNode('var_declare', { name: '__probe', type: 'auto' }, { initializer: [node] })
      : node
  return createNode('program', {}, { body: [...prelude, stmt] })
}

function findConcept(node: SemanticNode | null, id: string): boolean {
  if (!node) return false
  if (node.conceptId === id) return true
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
        generated = generateCode(wrap(node, id), 'cpp', STYLE)
        // ⚠️ **「這個概念自己產出了什麼」用差分算，不用形狀猜。**
        //
        // 第一版靠正則剝掉「看起來像鷹架」的行（`#include`／`using `／`int main`…）。
        // 而 `cpp_include`／`cpp_using_namespace` 這幾個概念的**產出就是那個形狀**
        // ——它們的輸出被自己的過濾器剝光，於是判成殼。
        //
        // 後果不只是數字錯：那四個概念因此被加上 `skipPaths: ['generate']`
        // 宣告成「由父概念消費」——**一個為了繞過量測假象而生的假宣告**，
        // 正是 `history/018` 說的「用宣告刷數字」。實測（有無節點兩次產生）
        // 證明它們自己就會產出，父概念沒有消費它們。
        //
        // 差分不需要知道哪些行是鷹架：**沒有這個節點時也會出現的，就不是它產的。**
        const 鷹架 = generateCode(wrap(null, id), 'cpp', STYLE)
        const 鷹架行 = new Set(鷹架.split('\n').map((l) => l.trim()))
        const own = generated
          .split('\n')
          .filter((l) => !鷹架行.has(l.trim()))
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
      // generate 被宣告為「由父概念消費」時，合成流程產不出程式碼——
      // **lift 因此沒有輸入可測**。那是判不出來，不是殼也不是缺：
      // 怪 lift 沒辦到一件沒有輸入的事，只會讓數字灌水。
      //
      // （只認 `implemented` 的話會誤判成「缺」，那是另一種灌水。兩種都試過。）
      if (row.generate.verdict === 'declared')
        return {
          verdict: 'undecidable',
          reason: 'generate 由父概念消費，合成流程產不出程式碼——lift 沒有輸入可測',
        } as PathResult
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
        // 概念自己宣告了「由父概念消費」——那句話對 lift 一樣成立：
        // 它**只在父節點裡才出現**，單獨合成一份樣本去量它是在量一個
        // 不存在的位置。
        //
        // ⚠️ 語法解析**不會**報錯（`virtual int f(){}` 放在頂層照樣 parse
        // 得過），所以上面那道 `hasError` 攔不住它——實測有五個類別成員
        // 因此被誤判為 lift 殼。包進類別裡量的話它們全部辨識正確。
        //
        // 這裡不新增宣告，**重用既有的那個**：能宣告 `consumed-by-parent`
        // 的門檻已經很嚴（要有逐一查證的證據測試），沿用它就沿用了那道門檻。
        if (skipReason(id, 'execute') === 'consumed-by-parent') {
          return {
            verdict: 'undecidable',
            reason: '概念宣告了 consumed-by-parent——它只在父節點裡出現，單獨量不到',
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
        if (back.conceptId !== id)
          return { verdict: 'shell', reason: `取回的身分是 ${back.conceptId}，不是 ${id}` } as PathResult
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
    if (spec.codeTemplate?.pattern && spec.conceptMapping?.conceptId) {
      tg.registerTemplate(spec.conceptMapping.conceptId, spec.codeTemplate)
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

  // ─────────────────────────────────────────────────────────────
  // 這裡原本是「殼與缺的總數不為零——零代表沒有真的量到東西」。
  //
  // **2026-08-06：它歸零了。** 而那個錨點爛掉是**設計上的必然**——
  // 一條護欄的目的就是讓它量的東西變好：
  //
  //   > 護欄修好了它要量的東西，就是它的錨點爛掉的時候。
  //   > ——`knowledge/history/022`
  //
  // **同一顆地雷本階段第四次**（辨識歧義、雙重真相、分類護欄、這裡）。
  // 改成合成注入：一個絕不會被實作的假概念，它的五路必然全缺。
  // 合成輸入不隨真實世界的修復而失效。
  // ─────────────────────────────────────────────────────────────
  it('★ 合成注入：一個不存在的概念必須被判為缺（零才可信）', () => {
    const 假概念 = {
      conceptId: '__zz_never_implemented__',
      layer: 'lang-core',
      properties: [],
      children: {},
      role: 'statement',
    } as unknown as ConceptDefJSON
    const { row } = classify(假概念)
    const 判定 = [row.lift, row.render, row.extract, row.generate, row.execute].map((r) => r.verdict)
    expect(
      判定.some((v) => v === 'missing' || v === 'shell'),
      '一個**完全不存在**的概念被判為五路俱全 → **量測根本沒有在跑**，' +
        '而它與健康的量測產出一模一樣。這支是唯一分得出來的地方。',
    ).toBe(true)
  })

  it('★ 對照組：一個真的實作了的概念不得被判為缺', () => {
    // 沒有這支的話，一個「什麼都判缺」的量測也會通過上一支
    const real = allComponentDefs().find((d) => d.conceptId === 'var_declare')!
    const { row } = classify(real)
    expect(row.execute.verdict, 'var_declare 的執行被判為缺 → 量測壞了').not.toBe('missing')
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
