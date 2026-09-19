/**
 * **位置的相鄰一格：四個面向**——`cpp:pointer_step`（`prev`／`next`，2026-09-19）。
 *
 * ## 它從語料來
 *
 * `prev(` 在 218 支學生程式裡 **10 處 / 8 支**，而**每一處都是 `prev(X.end())`**
 * ——那是「取最後一個」在有序容器上**唯一的寫法**（`set` 沒有 `back()`）。
 *
 * ## 四個面向
 *
 * | 面向 | 這裡怎麼量 | 紅了的症狀 |
 * |---|---|---|
 * | ① 產出的程式碼 | lift → 產碼 | **`prev(s.end())` 變成 `s.end() - 1`**——`set` 沒有隨機存取，那樣編不過 |
 * | ② 語義的不動點 | lift → 產碼 → 再 lift | 來回一趟就變 |
 * | ③ 載得進工作區 | render → Blockly load | **一片空白**（不是少一行） |
 * | ④ 走一趟積木回來 | render → extract → 產碼 | 學生一動積木，程式碼就變了 |
 *
 * 🔴 **④ 是這一刀最該找的東西**：`DIRECTION` 那一格是**方向**，
 * 而它是這顆身分與別顆的唯一差別。掉了的話 `prev` 會變成 `next`，
 * 而**產出的程式碼仍然合法**——最難發現的那一種。
 *
 * ⚠️ 第五個面向（跑起來與 g++ 一不一樣）在
 * `tests/integration/interpreter-matches-compiler.test.ts`（9 條）。
 *
 * ## ⚠️ 判準裡不得放未定義行為
 *
 * `prev(v.begin())` 與 `next(v.end())` 都是 UB——我們的處置是
 * 「不發明答案，讓解參考出聲」，而**那個訊息的文字不寫進判準**。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import * as Blockly from 'blockly'
import { registerFieldMultilineInput } from '@blockly/field-multilineinput'
import { registerDynamicDropdownField, declareDropdownSource } from '../../src/ui/dynamic-dropdown-field'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
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
import type { SemanticNode, StylePreset } from '../../src/core/types'

/**
 * **從語料蒸餾出來的形狀**，不是抄一整支——
 * `STUDYCPP_DIR` 沒設時那些探針會跳過，而**跳過的護欄與不存在的護欄長得一樣**。
 */
const SHAPES: readonly [string, string][] = [
  // ── 語料真的有的四種（10 處全部落在這四種裡）──
  ['語料：set 的最後一個（AP325/4/4_8）', '  cout << *prev(st.end());'],
  ['語料：累加最後一個（AP325/7/7_11_2t）', '  h += *prev(st.end());'],
  ['語料：刪掉最後一個（tioj/20_toj275）', '  s.erase(prev(s.end()));'],
  ['語料：最後一個減第一個（w/APCS/j607）', '  x = *prev(v.end()) - *v.begin();'],
  // ── 同一顆身分的另一個方向（語料 0 處，而積木做得出來）──
  ['方向：往後一格', '  cout << *next(v.begin());'],
  ['方向：反向的位置上往後', '  cout << *next(v.rbegin());'],
  // ── 嵌在別人裡面 ──
  ['嵌套：當範圍的端點', '  sort(v.begin(), prev(v.end()));'],
  ['嵌套：兩層（前一個的前一個）', '  cout << *prev(prev(v.end()));'],
  // ── ★ 正向錨點：既有的寫法不得被弄壞 ──
  ['★ `v.end() - 1` 照舊（隨機存取容器的另一種寫法）', '  cout << *(v.end() - 1);'],
  ['★ `*v.begin()` 照舊', '  cout << *v.begin();'],
]

const wrap = (body: string): string =>
  '#include <bits/stdc++.h>\nusing namespace std;\n'
  + 'int main() {\n  int h = 0, x = 0;\n  set<int> st{1,2,3}, s{4,5};\n  vector<int> v{7,8,9};\n'
  + `${body}\n  return 0;\n}\n`

const S = apcs as unknown as StylePreset

let parser: Parser
let blockExtractor: PatternExtractor

beforeAll(async () => {
  await Parser.init({ locateFile: (f: string) => `${process.cwd()}/public/${f}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()

  registerFieldMultilineInput()
  registerDynamicDropdownField()
  // ⚠️ **產品宣告哪些，這裡就要宣告哪些**——少一個的症狀是「每一支都紅」，
  //    而那是護欄壞了，不是產品壞了。
  for (const k of ['names', 'vars', 'funcs', 'arrays',
    'cpp_var_types', 'cpp_param_types', 'cpp_return_types', 'python_types']) {
    declareDropdownSource(k, () => [])
  }
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
  blockExtractor = new PatternExtractor()
  blockExtractor.loadBlockSpecs(reg.getAll())
  registerCppExtractStrategies(blockExtractor)
}, 180_000)

const lift = (src: string): SemanticNode =>
  createTestLifter().lift(parser.parse(src)!.rootNode as never) as SemanticNode
const squash = (x: string): string => x.replace(/\s+/g, '')
const ids = (n: SemanticNode, out: string[] = []): string[] => {
  out.push(n.componentId)
  for (const ks of Object.values(n.slots ?? {})) for (const k of ks) ids(k, out)
  return out
}
/**
 * 只留下這一段自己那幾行——骨架的宣告不比。
 * ⚠️ **不照原文過濾**（範圍那一族踩過，18 支全紅）：走一趟積木回來之後
 *    `set<int> st{1,2,3}, s{4,5};` 會被攤成兩顆積木，而那是對的。
 * > **當一個新的檢查連【正向錨點】都紅的時候，先懷疑那個檢查。**
 */
const SCAFFOLD = /^(#include|using namespace|int main)|^\}$|^return 0;$|^(int|set<int>|vector<int>)\s+(h|x|st|s|v)\b[^;]*;$/
const meat = (code: string): string =>
  code.split('\n').map((l) => l.trim()).filter((l) => l && !SCAFFOLD.test(l)).join(' ')

describe('位置的相鄰一格：四個面向', () => {
  it('★ 入口條件——這條路真的跑得動（否則下面每一條都在驗空氣）', () => {
    expect(ids(lift(wrap('  cout << *prev(st.end());')))).toContain('cpp:pointer_step')
  })

  describe('① 產出的程式碼：lift → 產碼，一字不差', () => {
    it.each(SHAPES)('%s', (_name, body) => {
      const out = meat(generateCode(lift(wrap(body)), 'cpp', S))
      expect(squash(out), '🔴 產出的程式碼變了').toBe(squash(body))
    })
  })

  describe('② 語義的不動點：再 lift 一次還是同一棵', () => {
    it.each(SHAPES)('%s', (_name, body) => {
      const once = generateCode(lift(wrap(body)), 'cpp', S)
      expect(generateCode(lift(once), 'cpp', S), '🔴 來回一趟就走樣了').toBe(once)
    })
  })

  describe('③ 載得進工作區（紅了是一片空白，不是少一行）', () => {
    it.each(SHAPES)('%s', (_name, body) => {
      const { blockMappings: _drop, ...state } = renderToBlocklyState(lift(wrap(body)))
      const ws = new Blockly.Workspace()
      let err: string | null = null
      try { Blockly.serialization.workspaces.load(state, ws) }
      catch (e) { err = e instanceof Error ? e.message : String(e) }
      finally { ws.dispose() }
      expect(err, '🔴 載不進去——使用者看到的不是少一行，是一片空白').toBeNull()
    })
  })

  describe('④ 走一趟積木回來（紅了是學生一動積木程式就變了）', () => {
    function chainOf(b0: unknown): SemanticNode[] {
      const acc: SemanticNode[] = []
      let cur = b0 as { next?: { block: unknown } } | undefined
      while (cur) {
        const n = blockExtractor.extract(cur as never)
        if (n) acc.push(n)
        cur = (cur.next?.block ?? undefined) as typeof cur
      }
      return acc
    }
    it.each(SHAPES)('%s', (_name, body) => {
      const { blockMappings: _drop, ...state } = renderToBlocklyState(lift(wrap(body)))
      const backs = (state.blocks.blocks as unknown[]).flatMap(chainOf)
      const rebuilt = { componentId: 'cpp:program', properties: {}, slots: { body: backs } } as SemanticNode
      expect(
        squash(meat(generateCode(rebuilt, 'cpp', S))),
        '🔴 走一趟積木之後那一段變了——**學生一動積木，他的程式就變了**。',
      ).toBe(squash(body))
    })

    /**
     * 🔴 **方向那一格單獨再釘一次**——上面那一族比的是整段文字，
     * 而**文字相同不代表那一格是從積木上讀回來的**（它可能被預設值補回去）。
     * 判準改成「切到 `next` 之後走一趟，讀回來的屬性仍然是 `next`」。
     */
    it('🔴 `DIRECTION` 那一格走一趟回來不得掉（掉了 prev 會變成 next，而碼仍然合法）', () => {
      for (const dir of ['prev', 'next'] as const) {
        const { blockMappings: _drop, ...state } = renderToBlocklyState(
          lift(wrap(`  cout << *${dir}(v.begin());`)))
        const backs = (state.blocks.blocks as unknown[]).flatMap(chainOf)
        const found: SemanticNode[] = []
        const dig = (n: SemanticNode): void => {
          if (n.componentId === 'cpp:pointer_step') found.push(n)
          for (const ks of Object.values(n.slots ?? {})) for (const k of ks) dig(k)
        }
        for (const b of backs) dig(b)
        expect(found.length, `🔴 走一趟回來之後那顆不見了（${dir}）`).toBeGreaterThan(0)
        expect(found[0].properties.direction, `🔴 方向掉了（${dir}）`).toBe(dir)
      }
    })

    /**
     * 🔴 **接點走一趟回來要接得回去**——`POS` 裡是一整顆 `cpp:container_iter`。
     * 掉了的話產出的碼是 `prev()`，而那編不過。
     */
    it('🔴 `POS` 那一格走一趟回來要仍然是一顆積木，不是一個洞', () => {
      const { blockMappings: _drop, ...state } = renderToBlocklyState(
        lift(wrap('  cout << *prev(st.end());')))
      const backs = (state.blocks.blocks as unknown[]).flatMap(chainOf)
      const found: SemanticNode[] = []
      const dig = (n: SemanticNode): void => {
        if (n.componentId === 'cpp:pointer_step') found.push(n)
        for (const ks of Object.values(n.slots ?? {})) for (const k of ks) dig(k)
      }
      for (const b of backs) dig(b)
      expect(found.length).toBeGreaterThan(0)
      expect(found[0].slots.pos?.[0]?.componentId, '🔴 位置那一格掉了 → 產出 `prev()`，編不過')
        .toBe('cpp:container_iter')
    })
  })

  /**
   * **一個沒接上的插槽，產出的碼要編得過**（範圍那一族的瀏覽器驗收抓到的）。
   * ⚠️ 這一顆今天**沒有**退路——`generateExpression(undefined)` 會產出空字串，
   *    於是剛拖出來的積木產出 `prev()`。**那是這一刀已知的缺口**，見下。
   */
  it('🟠 剛拖出來（位置沒接上）時產出的碼——記錄現況，不是驗收', () => {
    const bare = { componentId: 'cpp:pointer_step', properties: { direction: 'prev' }, slots: {} } as SemanticNode
    const out = generateCode(
      { componentId: 'cpp:program', properties: {}, slots: { body: [bare] } } as SemanticNode, 'cpp', S)
    // ⚠️ **這一條不是「應該長這樣」**，是「今天長這樣」。判準見下面那一段註解。
    expect(out).toContain('prev(')
  })
})
