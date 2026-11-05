/**
 * **換形態，判決不變（第一層）**——宣告的第五個面向：同一棵語意樹換一種形態再轉回來，翻給 Cella 的程式相同（spec 213）。
 *
 * 前四個面向（①產出的程式碼 ②語義的不動點 ③載得進工作區 ④走一趟積木回來）都是**形狀**；這一個是**意思**。
 * 形狀全對而意思被換掉（例如走一趟積木回來，型別換了、運算子換了）只有它看得到。來源：三方會議第三輪的不變式 ①（history/334 後記）。
 *
 * 語料：課文判決綁定語料（`tests/helpers/binding-corpus`）。三種轉換：
 *   (a) 同風格產碼再讀回  (b) 只改格式的風格切換（縮排、命名空間、標頭；I/O 風格相同的配對）  (c) 轉積木再抽回
 * 比的是正規化的程式（節點編號依出現順序重新編號）。
 * ⚠️ I/O 風格切換（cout ↔ printf）會換掉語意樹本身，翻給 Cella 的程式本來就不同——那一類歸判決層，不在這裡比。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import * as Blockly from 'blockly'
import { registerFieldMultilineInput } from '@blockly/field-multilineinput'
import { createTestLifter } from '../helpers/setup-lifter'
import { sources } from '../helpers/binding-corpus'
import { normalizeFormal, firstDifference } from '../helpers/normalize-formal'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode, setHeaderAliases, setExpressionTypes } from '../../src/core/projection/code-generator'
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
import cTarget from '../../src/languages/cpp/targets/c.json'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import google from '../../src/languages/cpp/styles/google.json'
import cStyle from '../../src/languages/cpp/styles/c.json'
import competitive from '../../src/languages/cpp/styles/competitive.json'
import { runCella, cellaTypesOfTree } from '../helpers/cella-run'
import type { SemanticNode, StylePreset } from '../../src/core/types'

const S = (x: unknown) => x as StylePreset
let parser: Parser
let extractor: PatternExtractor
type Shaping = { autoIncludeNodes: (t: SemanticNode, ns: 'using' | 'explicit', styleId: string) => SemanticNode[]; patchCode: (...a: unknown[]) => string | null }
let shaping: Shaping

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
  shaping = languagePack('cpp')!.createCodeShaping!() as unknown as Shaping
  // 積木那一路：與 declaration-shapes-roundtrip 同一套（產品宣告哪些，這裡就宣告哪些）
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

const lift = (code: string): SemanticNode => createTestLifter().lift(parser.parse(code)!.rootNode as never) as SemanticNode

interface Row { id: string; tree: SemanticNode; style: StylePreset; alt?: StylePreset; opts: { board?: string; lang?: 'c' | 'cpp' } }

/** 產品交給 formalize 的那一棵：骨架節點（補丁器補的 #include／using）加在前面——與 binding-corpus 同一條路 */
function shown(tree: SemanticNode, style: StylePreset): SemanticNode {
  return { ...tree, slots: { ...tree.slots, body: [...shaping.autoIncludeNodes(tree, style.namespace_style as 'using' | 'explicit', style.id), ...(tree.slots.body ?? [])] } }
}
function formal(tree: SemanticNode, r: Row, style = r.style): unknown {
  const f = formalize(shown(tree, style), r.opts)
  return f.program ? normalizeFormal(f.program) : { untranslated: (f.unknown ?? []).map((u: { construct: string }) => u.construct) }
}
function viaCode(r: Row, style: StylePreset): SemanticNode {
  setHeaderAliases(r.opts.lang === 'c' ? (cTarget as { headerAliases?: Record<string, string> }).headerAliases : undefined)
  try { return lift(generateCode(r.tree, 'cpp', style)) } finally { setHeaderAliases(undefined) }
}
/** 沿著 next 走完一條鏈——extract 只讀一顆 */
function chainOf(b0: unknown): SemanticNode[] {
  const acc: SemanticNode[] = []
  let cur = b0 as { next?: { block: unknown } } | undefined
  while (cur) {
    const n = extractor.extract(cur as never)
    if (n) acc.push(n)
    cur = (cur.next?.block ?? undefined) as typeof cur
  }
  return acc
}
function viaBlocks(r: Row): SemanticNode {
  const { blockMappings: _drop, ...state } = renderToBlocklyState(r.tree)
  const backs = (state.blocks.blocks as unknown[]).flatMap(chainOf)
  return { ...r.tree, slots: { ...r.tree.slots, body: backs } }
}

function rows(): Row[] {
  return sources().map((s) => {
    const style = S(s.board ? google : s.lang === 'c' ? cStyle : apcs)
    // 只改格式的另一個風格：I/O 風格相同的配對（apcs ↔ google 都是 cout）；C 沒有同 I/O 風格的另一個，不換
    const alt = s.lang === 'c' ? undefined : S(style.id === 'google' ? apcs : google)
    return { id: s.id, tree: lift(s.code), style, alt, opts: { board: s.board, lang: s.lang } }
  })
}

/** 一種轉換之後不一致的那幾支：「支｜第一個不同的路徑」 */
function mismatches(transform: (r: Row) => unknown, rs: Row[]): string[] {
  const out: string[] = []
  for (const r of rs) {
    let after: unknown
    try { after = transform(r) } catch (e) { out.push(`${r.id}｜轉換丟例外：${String(e).slice(0, 80)}`); continue }
    const before = formal(r.tree, r)
    const gone = (x: unknown) => (x as { untranslated?: string[] }).untranslated
    if (gone(after) && !gone(before)) { out.push(`${r.id}｜轉換後翻不出：${gone(after)!.join('、')}`); continue }
    const d = firstDifference(before, after)
    if (d) out.push(`${r.id}｜${d}`)
  }
  return out
}

describe('換形態，判決不變（第五個面向）', () => {
  it('★ 注入：一個會換意思的轉換必紅，並指名差在哪', () => {
    const r: Row = { id: '注入', tree: lift('#include <iostream>\nusing namespace std;\nint main() {\n  int x = 1;\n  cout << x;\n  return 0;\n}\n'), style: S(apcs), opts: {} }
    const changed = mismatches((row) => formal(lift(generateCode(row.tree, 'cpp', row.style).replace('= 1', '= 2')), row), [r])
    expect(changed).toHaveLength(1)
    expect(changed[0]).toMatch(/\.v：1 ≠ 2/)
    expect(mismatches((row) => formal(viaCode(row, row.style), row), [r]), '對照組：沒改的轉換不得紅').toEqual([])
  })

  /**
   * 學生語料量到、課文沒有的形狀（2026-11-04 spec 213 的探針 form-invariance-studycpp）：走一趟積木就換意思或翻不出。
   * 修好的三族在這裡常駐（「運算式當敘述」那一族在 spec 214 修好）。
   */
  const H = '#include <bits/stdc++.h>\nusing namespace std;\n'
  const same = (code: string): string | null => {
    const r: Row = { id: 'shape', tree: lift(code), style: S(apcs), opts: {} }
    const before = formal(r.tree, r), after = formal(viaBlocks(r), r)
    const gone = (after as { untranslated?: string[] }).untranslated
    return gone ? `翻不出：${gone.join('、')}` : firstDifference(before, after)
  }
  it('🔴 空的 case（往下掉）走一趟積木：switch 照樣翻得出', () => {
    expect(same(H + 'int main() {\n  int x = 9;\n  switch (x) {\n    case 10:\n    case 9:\n      cout << "A";\n      break;\n    default:\n      cout << "?";\n  }\n  return 0;\n}\n')).toBeNull()
  })
  it('🔴 struct 裡一次宣告多個欄位（int x, y;）走一趟積木：欄位不得消失', () => {
    expect(same(H + 'struct P {\n  int x, y;\n  bool operator<(P b) {\n    return x < b.x;\n  }\n};\nint main() {\n  return 0;\n}\n')).toBeNull()
  })
  it.each([
    ['cc[1];（運算式當敘述）', H + 'int main() {\n  map<int, int> cc;\n  cc[1];\n  return 0;\n}\n'],
    ['(c ? A = 1 : A = 0);', H + 'int main() {\n  int A;\n  (1 ? A = 1 : A = 0);\n  return 0;\n}\n'],
  ])('🔴 運算式當敘述走一趟積木：%s 留在原位（spec 214 的包裝積木）', (_l, code) => {
    // 原本：沒有敘述形態的運算式渲染成浮動的頂層積木（2026-09-10：不丟、不硬接），抽回來時跑到 main 外面。
    expect(same(code)).toBeNull()
    // ③ 載得進工作區：包裝接在鏈上，Blockly 不拒絕
    const { blockMappings: _drop, ...state } = renderToBlocklyState(lift(code))
    const ws = new Blockly.Workspace()
    Blockly.serialization.workspaces.load(state as never, ws)
    expect(ws.getAllBlocks(false).some((b) => b.type === 'cpp_expression_statement')).toBe(true)
    expect(ws.getTopBlocks(false), '整支程式是一串，沒有浮在旁邊的').toHaveLength(1)
    ws.dispose()
  })
  it('🔴 for 的第一格是指標宣告（for (int* p = begin(a); …)）走一趟積木：照樣翻得出', () => {
    // 原本 pointer_declare 沒有運算式形態，在 for 的 INIT 被降級成原文積木（學生語料 basic/14_array_1，spec 214 順手修）
    expect(same(H + 'int main() {\n  int a[3] = {1, 2, 3};\n  for (int* p = begin(a); p != end(a); p++) {\n    cout << *p;\n  }\n  return 0;\n}\n')).toBeNull()
  })
  it.each([
    ['v.emplace_back(1);', H + 'int main() {\n  vector<int> v;\n  v.emplace_back(1);\n  return 0;\n}\n'],
    ['int &r = v.emplace_back(1);', H + 'int main() {\n  vector<int> v;\n  int &r = v.emplace_back(1);\n  return 0;\n}\n'],
    ['s.emplace(1);', H + 'int main() {\n  set<int> s;\n  s.emplace(1);\n  return 0;\n}\n'],
  ])('🔴 排版提示走一趟積木不被改寫：%s（renderMapping.hints，spec 214）', (_l, code) => {
    // 原本：方法名的拼法積木上刻意沒有一格（「排版提示，不給學生編輯」），而抽回來就退成預設——emplace_back → push_back、emplace → insert
    const r: Row = { id: 'hint', tree: lift(code), style: S(apcs), opts: {} }
    expect(generateCode(viaBlocks(r), 'cpp', S(apcs))).toBe(generateCode(r.tree, 'cpp', S(apcs)))
    expect(same(code)).toBeNull()
  })
  it('🔴 有敘述形態的元件不套包裝；空的包裝不產節點', () => {
    const { blockMappings: _drop, ...state } = renderToBlocklyState(lift(H + 'int main() {\n  vector<int> v;\n  v.push_back(1);\n  return 0;\n}\n'))
    expect(JSON.stringify(state)).not.toContain('cpp_expression_statement')
    expect(extractor.extract({ type: 'cpp_expression_statement', id: 'w', fields: {}, inputs: {} } as never)).toBeNull()
  })

  it('🔴 (a) 同風格產碼再讀回：翻給 Cella 的程式相同', () => {
    const rs = rows()
    expect(rs.length, '語料讀不到 → 下面的 0 是零樣本').toBeGreaterThan(90)
    expect(mismatches((r) => formal(viaCode(r, r.style), r), rs)).toEqual([])
  })

  /**
   * 命名空間這一軸：`using namespace std;` ＋ `cout` 與 `std::cout` 意思相同，而程式 JSON 一個多一項 `iUsing`、名字一個帶前綴。
   * 比較前兩邊都拿掉 `iUsing std`、名字去掉 `std::`——這是**表面的寫法**，不是意思。
   */
  const dropStd = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.filter((x) => !(x && typeof x === 'object' && (x as { k?: string }).k === 'iUsing')).map(dropStd)
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, dropStd(x)]))
    return typeof v === 'string' ? v.replace(/^std::/, '') : v
  }

  it('🔴 (b) 只改格式的風格切換：翻給 Cella 的程式相同（命名空間的寫法不算）', () => {
    const rs = rows().filter((r) => r.alt)
    const out: string[] = []
    for (const r of rs) {
      const d = firstDifference(dropStd(formal(r.tree, r)), dropStd(formal(viaCode(r, r.alt!), r, r.alt)))
      if (d) out.push(`${r.id}｜${d}`)
    }
    expect(out).toEqual([])
  })

  it('🔴 (c) 轉積木再抽回：翻給 Cella 的程式相同', () => {
    expect(mismatches((r) => formal(viaBlocks(r), r), rows())).toEqual([])
  })

  /**
   * **判決層**：I/O 風格切換（`cout` → `printf`）會換掉語意樹本身（不同的元件），翻給 Cella 的程式本來就不同；
   * 那一類比的是 **Cella 的判決與輸出相同**——學生按下風格按鈕，程式跑出來的東西不能變。
   */
  it('🔴 I/O 風格切換（cout → printf）：Cella 的判決與輸出相同', async () => {
    const rs = rows().filter((r) => !r.opts.board && r.opts.lang !== 'c' && r.style.io_style === 'cout')
    expect(rs.length).toBeGreaterThan(50)
    const out: string[] = []
    for (const r of rs) {
      const before = await runCella(generateCode(r.tree, 'cpp', r.style))
      // 型別由 Cella 給（spec 215）——產品裡是每次檢查回來的 `types.nodes`，這裡直接問
      setExpressionTypes(await cellaTypesOfTree(shown(r.tree, r.style)))
      let after
      try { after = await runCella(generateCode(viaCode(r, S(competitive)), 'cpp', S(competitive))) } finally { setExpressionTypes(null) }
      if (before.verdict !== after.verdict || before.out !== after.out) {
        out.push(`${r.id}｜${before.verdict} ${JSON.stringify(before.out).slice(0, 40)} → ${after.verdict} ${JSON.stringify(after.out).slice(0, 40)}${after.problems[0] ? `（${after.problems[0].kind}：${(after.problems[0].reason ?? '').slice(0, 60)}）` : ''}`)
      }
    }
    // 已知、釘住的（修好時那一筆會從 out 消失，下面的「過期」那一條就會紅，逼人來拔）
    const unknown = out.filter((l) => !(l.split('｜')[0] in IO_SWITCH_KNOWN))
    expect(unknown, '🔴 新的不一致——判是誰的缺陷，修掉或釘進 IO_SWITCH_KNOWN').toEqual([])
    const stale = Object.keys(IO_SWITCH_KNOWN).filter((id) => !out.some((l) => l.startsWith(`${id}｜`)))
    expect(stale, '這幾支已經一致了——從 IO_SWITCH_KNOWN 拿掉').toEqual([])
  }, 300_000)
})

/**
 * I/O 風格切換的已知不一致——**今天是零**（265 之後；Cella 字串下標的型別在 0.1.202611050117 修好，那 2 支的釘子拔掉）。
 * spec 213 第一次量到 17 支：
 * - ~~Cella：printf 的格式字串裡直接寫中文會亂碼~~（7 支）——cella 0.1.202611041233 修好。
 * - ~~我們這側：printf 產碼沒有型別表~~（10 支：char 印成數字、double／long long 判 ubPrintf、string 當指標）——
 *   spec 215 照 Cella 給的型別產（`%c`／`%g`／`%lld`／`%s` ＋ `.c_str()`／`%zu`），推不出的保留 cout 並註明。
 * 新的不一致照樣先判是誰的缺陷：修掉，或附理由釘進這裡（修好時「過期」那一條會紅，逼人來拔）。
 */
const IO_SWITCH_KNOWN: Record<string, string> = {}
