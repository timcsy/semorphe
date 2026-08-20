/**
 * **第一週語法的接點要走得完來回。**
 *
 * ## 它從哪來
 *
 * 使用者撞過一次：`int a[3] = {1,2,3}` 拖一下積木，**初始值就消失了**。
 * 而 `audit-conformance` 量到**同一個機制的另外 12 個出口**，
 * 其中三顆是第一週的語法：
 *
 * ```
 * string s = "hi"      初始值   🔴 消失
 * int a, b, c          第二個起  🔴 消失
 * vector<int> v(10)    大小     🔴 消失——而【那會讓程式跑起來不一樣】
 * ```
 *
 * ⚠️ **這支與符合性護欄的差別**：護欄掃**全部** 189 顆並收棘輪，
 * 而這支只釘**這三顆**，用**看得懂的樣本**。
 * 護欄告訴你「數字是幾」，這支告訴你「`string s = "hi"` 會不會掉」。
 *
 * ## ⚠️ 一個接點一棵樹
 *
 * 沿用護欄的做法（`audit-conformance` 逐字）：
 * 「合成器不知道哪些接點是**互斥**的……一次全放會造出一棵真實世界不存在的樹」。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { setupTestRenderer } from '../helpers/setup-renderer'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { renderToBlocklyState } from '../../src/core/projection/block-renderer'
import { PatternExtractor } from '../../src/core/projection/pattern-extractor'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { registerCppExtractStrategies } from '../../src/languages/cpp/extractors/extract-strategies'
import { allCppProjections, allCppComponents } from '../../src/languages/cpp/all-declarations'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'

let parser: Parser
/** 從**真實程式碼**產出語義樹——⚠️ 形狀由 lift 決定，不由我決定。 */
const liftCode = (c: string): SemanticNode =>
  createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode
import { createNode } from '../../src/core/semantic-tree'
import type { SemanticNode } from '../../src/core/types'

interface BlockState { type?: string; [k: string]: unknown }
let extractor: PatternExtractor

beforeAll(async () => {
  await Parser.init({ locateFile: (f: string) => `${process.cwd()}/public/${f}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  await setupTestRenderer()
  registerCppLanguage()
  const reg = new BlockSpecRegistry()
  reg.loadFromSplit(allCppComponents() as never, allCppProjections() as never)
  extractor = new PatternExtractor()
  extractor.loadBlockSpecs(reg.getAll())
  registerCppExtractStrategies(extractor)
})

/** 放進去 → render → extract → 那個接點回來了嗎。 */
function roundTrip(node: SemanticNode, slot: string): { ok: boolean; back: string[] | null } {
  try {
    const st = renderToBlocklyState(createNode('cpp:program', {}, { body: [node] }))
    const out = (st.blocks.blocks as BlockState[]).map((b) => extractor.extract(b as never)).filter(Boolean)
    const find = (n: SemanticNode | null): SemanticNode | null => {
      if (!n) return null
      if (n.componentId === node.componentId) return n
      for (const ks of Object.values(n.children ?? {})) for (const k of ks) { const r = find(k); if (r) return r }
      return null
    }
    const it = out.map((x) => find(x as SemanticNode)).find(Boolean) ?? null
    if (!it) return { ok: false, back: null }
    const back = Object.keys(it.children ?? {}).filter((k) => (it.children[k] ?? []).length > 0)
    return { ok: back.includes(slot), back }
  } catch {
    return { ok: false, back: null }
  }
}

const num = (v: string): SemanticNode => createNode('cpp:literal_number', { value: v }, {})
const str = (v: string): SemanticNode => createNode('cpp:literal_string', { value: v }, {})

describe('第一週語法的接點走得完來回', () => {
  it('★ 正向錨點：接點是空的時候，來回之後【仍然是空的】', () => {
    // ⚠️ 沒有這一條的話，「補了插槽而生出一個預設值」也會讓下面幾支變綠。
    const n = createNode('cpp:string_declare', { name: 's' }, {})
    const r = roundTrip(n, 'initializer')
    expect(r.back, '空的接點來回之後長出東西了 → 補插槽時生了預設值').not.toContain('initializer')
  })

  it('🔴 US1：`string s = "hi"` 的初始值不得消失', () => {
    const n = createNode('cpp:string_declare', { name: 's' }, { initializer: [str('hi')] })
    const r = roundTrip(n, 'initializer')
    expect(r.ok, `初始值走完來回不見了（回來的：${r.back?.join('、') ?? '(整顆都沒回來)'}）`).toBe(true)
  })

  /**
   * 🔴 **釘子：這一格今天是壞的，而修法很貴。**
   *
   * `cpp_vector_declare` 的積木**在 `block-registrar.ts:558` 命令式產生**，
   * 而 `forms/blocks.json` 的 `args0` 是空的——那是 `CLAUDE.md` 記的**雙重真相**：
   * 「修改任一方時**必須同步另一方**」。
   *
   * 所以補這個插槽要**兩邊都改** ＋ 同步抽取端，而它與 `string_declare`
   * （JSON 就是唯一真相，改一個檔）是**完全不同的成本**。
   *
   * ⚠️ 用 `it.fails` 而不是 `it.todo`：**修好的那天它會紅**，逼人來拔釘子。
   * （`experience`：`it.todo` 本身就是一種殼——它宣告了一個缺陷，
   * 而沒有任何機構在看那個缺陷還在不在。）
   *
   * ## 🟢 2026-08-18：**釘子按設計運作了**
   *
   * 「投影遺失」護欄（第四十六條）掃出 `cpp:vector_declare` 的 `source`／
   * `size`／`fill` 三個接點在積木上沒有落點——補上插槽之後，**這支測試變紅**，
   * 逼我來拔它。
   *
   * > **一個會在缺陷被修好時變紅的釘子，
   * > 是唯一一種不會被遺忘的待辦。**
   *
   * ⚠️ 而上面那段「要兩邊都改」的成本分析**仍然成立**——這次補的是
   * `forms/blocks.json` 那一邊，而命令式那一份由 `dynamicRules` 之外的
   * `inputs` 對應接手。
   */
  it('🟢 US3：`vector<int> v(10)` 的大小走完來回還在（2026-08-18 修好，釘子已拔）', () => {
    // ⚠️ 前兩個是「字不見了」，**這一個是程式跑起來不一樣**：10 個元素變 0 個。
    const n = createNode('cpp:vector_declare', { name: 'v', type: 'int' }, { size: [num('10')] })
    const r = roundTrip(n, 'size')
    expect(r.ok, `大小走完來回不見了（回來的：${r.back?.join('、') ?? '(整顆都沒回來)'}）`).toBe(true)
  })

  it('🔴 US2：`int a, b, c` 的其餘變數不得消失', () => {
    // ⚠️ **2026-08-19 更正了餵進去的形狀。**
    //
    // 原本餵的是 `cpp:var_ref`——**型別是錯的**（lift 真的產出的是
    // `cpp:var_declare` 自己），而它**碰巧有 `.name`**，於是渲染策略讀得到、
    // 這支測試就過了。
    //
    // > **一個餵錯型別而碰巧通過的測試，
    // > 與一個真的在守著那件事的測試長得一模一樣。**
    //
    // 🔴 而同一個說謊的宣告（`declarators: 'expressions'`）讓**另外兩條護欄**
    // 各自報了一次假違規——見 `components/cpp/var_declare/component.json`。
    const n = createNode('cpp:var_declare', { type: 'int', name: 'a' }, {
      declarators: [
        createNode('cpp:var_declare', { name: 'b', type: 'int' }, {}),
        createNode('cpp:var_declare', { name: 'c', type: 'int' }, {}),
      ],
    })
    const r = roundTrip(n, 'declarators')
    expect(r.ok, `其餘變數走完來回不見了（回來的：${r.back?.join('、') ?? '(整顆都沒回來)'}）`).toBe(true)
  })

  it('🟢 US2 補強：從【真實程式碼】走完 lift → render → extract', () => {
    // 🔴 上面那些餵的是**合成節點**，而 2026-08-19 的教訓是
    //    「餵錯型別而碰巧通過」——合成節點永遠有這個風險。
    //
    // > **一條從真實程式碼出發的斷言，不會餵錯形狀
    // > ——因為形狀是 lift 決定的，不是我決定的。**
    const src = 'int main() { int a, b, c; return 0; }\n'
    const t = liftCode(src)
    const st = renderToBlocklyState(t)
    const back = (st.blocks.blocks as BlockState[]).map((b) => extractor.extract(b as never)).filter(Boolean)
    const find = (n: SemanticNode | null): SemanticNode | null => {
      if (!n) return null
      if (n.componentId === 'cpp:var_declare' && (n.children.declarators ?? []).length > 0) return n
      for (const ks of Object.values(n.children ?? {})) for (const k of ks) { const r = find(k); if (r) return r }
      return null
    }
    const d = (back as SemanticNode[]).map(find).find(Boolean)
    expect(d, '多變數宣告沒有回來').toBeDefined()          // ← 正向錨點
    expect((d?.children.declarators ?? []).map((x) => x.properties.name)).toEqual(['a', 'b', 'c'])
  })
})
