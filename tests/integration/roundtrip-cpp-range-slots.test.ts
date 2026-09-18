/**
 * **範圍那一族的四個面向**——`begin`／`end` 從字串屬性換成接點之後（2026-09-18）。
 *
 * ## 為什麼另開一支，不塞進第一百一十五條那一支
 *
 * 那一支的主體是**宣告**（「一個宣告寫成什麼樣，轉一圈回來還是那個樣」）。
 * 範圍演算法不是宣告——塞進去會讓那條護欄的名字不再描述它的內容，
 * 而**一個名字不再描述內容的檢查，下一個人會用錯的理由去讀它的紅**。
 *
 * ## 這一刀動了什麼（所以要驗什麼）
 *
 * ```
 * 10 顆範圍演算法   begin／end（＋前綴和的 dest）從【字串屬性】變成【接點】
 *  3 顆新元件       range_find／range_unique／range_remove
 *  1 顆加屬性       container_iter 的 call（begin(a) 這個自由函式形式）
 * ```
 *
 * 🔴 **最大的迴歸風險有名字**：`sort(A, A+n)` 這種裸指標算術在語料裡有 **33 處**，
 * 今天是綠的，而 `CONTAINER` 那個字串欄位**整個退場**了——那條路整個換人走。
 * 所以下面每一組都先釘**正向錨點**。
 *
 * ## 四個面向
 *
 * | 面向 | 這裡怎麼量 |
 * |---|---|
 * | ① 產出的程式碼 | lift → 產碼，逐字比 |
 * | ② 語義的不動點 | lift → 產碼 → 再 lift，兩棵一樣 |
 * | ③ 載得進工作區 | render → Blockly load（紅了是**一片空白**，不是少一行） |
 * | ④ 走一趟積木回來 | render → extract → 產碼（紅了是**學生一動積木程式就變了**） |
 *
 * ⚠️ 第五個面向（跑起來與 g++ 一不一樣）在
 * `interpreter-matches-compiler.test.ts`——那裡要參照編譯器，這裡不要。
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

const S = apcs as unknown as StylePreset

let parser: Parser
let blockExtractor: PatternExtractor

/**
 * 每一段都放在一個有東西可用的骨架裡。
 * ⚠️ `n`／`N` 先宣告好——不然 lift 出來的是一棵「用了沒宣告的名字」的樹，
 *    而那會讓下面每一條都在驗別的東西。
 */
const wrap = (body: string): string =>
  '#include <bits/stdc++.h>\nusing namespace std;\n'
  + 'int main() {\n  int n = 3, N = 3;\n  int A[5], fx[8], a[5], b[5];\n'
  + '  vector<int> v, w;\n  vector<int> d2[5];\n'
  + `${body}\n  return 0;\n}\n`

/**
 * **從語料蒸餾出來的形狀**，不是抄一整支——
 * `STUDYCPP_DIR` 沒設時那些探針會跳過，而**跳過的護欄與不存在的護欄長得一樣**。
 */
const SHAPES: readonly [string, string][] = [
  // ★ 正向錨點：裸指標算術那一族（語料 33 處，這一刀最大的迴歸風險）
  ['★ 裸陣列，字面偏移', '  sort(A, A + 5);'],
  ['★ 裸陣列，偏移是算出來的', '  sort(A, A + n);'],
  ['★ 兩端都有偏移（語料真的這樣寫）', '  sort(fx + 1, fx + N + 1);'],
  ['★ 成員形式', '  sort(v.begin(), v.end());'],
  ['★ 部分範圍', '  reverse(a, a + 3);'],
  ['★ 寫入型', '  fill(a, a + n, 0);'],
  ['★ 帶初值，運算式位置', '  int s = accumulate(v.begin(), v.end(), 0);'],
  ['★ 遞增填充', '  iota(v.begin(), v.end(), 1);'],
  ['★ 前綴和的第三格（dest）', '  partial_sum(a, a + n, b);'],
  ['★ 最大最小', '  int* p = max_element(a, a + n);'],
  ['★ 二分', '  int k = lower_bound(v.begin(), v.end(), 3) - v.begin();'],
  ['★ 比較器（它一直是接點）', '  sort(v.begin(), v.end(), [](int x, int y) { return x > y; });'],

  // 🆕 這一刀新救起來的四種形狀
  ['🆕 自由函式（原生陣列沒有成員 begin）', '  sort(begin(a), end(a));'],
  ['🆕 接收者是運算式', '  sort(d2[1].begin(), d2[1].end());'],
  ['🆕 找一個值，回傳位置', '  int* q = find(begin(a), end(a), 3);'],
  ['🆕 位置相減換算成索引', '  int i = find(begin(a), end(a), 3) - begin(a);'],
  ['🆕 擠掉相鄰重複（嵌在另一顆的引數裡）', '  v.erase(unique(v.begin(), v.end()), v.end());'],
  ['🆕 擠掉等於某個值的', '  v.erase(remove(v.begin(), v.end(), 1), v.end());'],
]

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
 *
 * ⚠️ **不能照著骨架的原文過濾**（2026-09-18 當場撞到，而且是 18 支全紅）：
 * 走一趟積木回來之後 `int A[5], fx[8], a[5], b[5];` 會被**攤成四顆積木**
 * ——那是對的（第一百一十八條那一支的註解逐字說過「攤成兩顆而那比原本好」），
 * 而一個照原文比對的過濾器會在那時候整批失效。
 *
 * > **當一個新的檢查連【正向錨點】都紅的時候，先懷疑那個檢查。**
 *
 * 🟢 判準改成**問那一行宣告的是不是骨架的名字**，與它寫成幾行無關。
 */
// ⚠️ **`\}` 要錨在整行**（第二個當場撞到的）：寫成 `^\}` 的話它會吃掉
//    lambda 的收尾 `});`，而症狀是「比較器那一條的尾巴不見了」。
const SCAFFOLD = /^(#include|using namespace|int main)|^\}$|^return 0;$|^(int|vector<int>)\s+(n|N|A|fx|a|b|v|w|d2)\b[^;]*;$/
const meat = (code: string): string =>
  code.split('\n').map((l) => l.trim())
    .filter((l) => l && !SCAFFOLD.test(l))
    .join(' ')

describe('範圍那一族：四個面向（兩端換成接點之後）', () => {
  it('★ 入口條件——這條路真的跑得動（否則下面每一條都在驗空氣）', () => {
    const src = wrap('  sort(A, A + 5);')
    expect(ids(lift(src))).toContain('cpp:range_sort')
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
      const twice = generateCode(lift(once), 'cpp', S)
      expect(twice, '🔴 來回一趟就走樣了').toBe(once)
    })
  })

  describe('③ 載得進工作區（紅了是一片空白，不是少一行）', () => {
    it.each(SHAPES)('%s', (_name, body) => {
      const { blockMappings: _drop, ...state } = renderToBlocklyState(lift(wrap(body)))
      const ws = new Blockly.Workspace()
      let err: string | null = null
      try {
        Blockly.serialization.workspaces.load(state, ws)
      } catch (e) {
        err = e instanceof Error ? e.message : String(e)
      } finally {
        ws.dispose()
      }
      expect(err, '🔴 載不進去——使用者看到的不是少一行，是一片空白').toBeNull()
    })
  })

  describe('④ 走一趟積木回來（紅了是學生一動積木程式就變了）', () => {
    /** 沿著 `next` 走完一條鏈——⚠️ `extract` 只讀一顆。 */
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
      const out = meat(generateCode(rebuilt, 'cpp', S))
      expect(
        squash(out),
        '🔴 走一趟積木之後那一段變了——**學生一動積木，他的程式就變了**。',
      ).toBe(squash(body))
    })
  })

  /**
   * **一個沒接上的插槽，產出的碼要編得過**（2026-09-18，瀏覽器驗收抓到）。
   *
   * 剛拖出來的積木在畫面上是對的（每一格是一個可讀的圓洞，還帶著 ⚠️），
   * 而產出的程式碼是 `find(v.begin(), v.end(), );`——**編不過**。
   *
   * > **一個半完成的程式該長什麼樣，是一個設計決定；
   * > 而「有的格子有答案、有的格子留一個語法錯誤」不是決定，是沒有決定。**
   */
  describe('★ 空插槽：產出的碼要編得過', () => {
    const bare = (t: string): string => {
      const n = { componentId: t, properties: {}, slots: {} } as SemanticNode
      return generateCode({ componentId: 'cpp:program', properties: {}, slots: { body: [n] } } as SemanticNode, 'cpp', S)
    }
    it.each([
      ['cpp:range_sort', 'sort(v.begin(), v.end());'],
      ['cpp:range_find', 'find(v.begin(), v.end(), 0)'],
      ['cpp:range_remove', 'remove(v.begin(), v.end(), 0)'],
      ['cpp:range_unique', 'unique(v.begin(), v.end())'],
      ['cpp:range_sum', 'accumulate(v.begin(), v.end(), 0)'],
      ['cpp:range_sum_partial', 'partial_sum(v.begin(), v.end(), result.begin());'],
      ['cpp:range_find_lower', 'lower_bound(v.begin(), v.end(), 0)'],
      ['cpp:range_fill_sequence', 'iota(v.begin(), v.end(), 0);'],
    ])('%s', (id, want) => {
      const out = bare(id)
      expect(out, `🔴 空插槽產出了編不過的東西：${out.trim()}`).toContain(want)
      expect(out, '🔴 產出了一個空引數').not.toMatch(/,\s*\)/)
    })

    /**
     * 🟠 **接收者那一族還沒補**——`cpp:container_erase` 的接收者沒接上時產出
     * `.erase();`，而那也編不過。
     *
     * ⚠️ **語料 0 處**（沒有人存一個半完成的程式再去編它），而它是
     * **56 顆元件**共同的形狀：每一顆都寫著
     * `generateExpression((node.slots.obj ?? [])[0], ctx)`，
     * 而 `generateExpression(undefined)` 回的是空字串。
     *
     * 🟠 為什麼不現在修：56 顆要一起改才不會留下「有的有、有的沒有」的不一致
     *    ——而那個不一致**正是這一條被漏掉的原因**。
     * 🔴 何時該修：**接收者的空值預設**那一刀（56 顆 ＋ 一條護欄）。
     */
    it.fails('[UNSUPPORTED:接收者的空值預設] 🟠 接收者沒接上時不得產出 `.erase()`', () => {
      expect(bare('cpp:container_erase')).not.toMatch(/(^|\s)\.\w+\(/m)
    })
  })

  /**
   * 🔴 **身分驗證**——只比字串的話，一顆用錯身分而碰巧產得出對的碼的元件會空過。
   */
  describe('★ 元件身分：不得退化成通用概念', () => {
    it.each([
      ['  sort(A, A + n);', 'cpp:range_sort'],
      ['  sort(begin(a), end(a));', 'cpp:container_iter'],
      ['  int* q = find(begin(a), end(a), 3);', 'cpp:range_find'],
      ['  v.erase(unique(v.begin(), v.end()), v.end());', 'cpp:range_unique'],
      ['  v.erase(remove(v.begin(), v.end(), 1), v.end());', 'cpp:range_remove'],
      ['  partial_sum(a, a + n, b);', 'cpp:range_sum_partial'],
    ])('%s → %s', (body, want) => {
      const all = ids(lift(wrap(body)))
      expect(all, `🔴 樹裡沒有 ${want}`).toContain(want)
      expect(all, '🔴 掉進殘差了').not.toContain('cpp:raw_code')
    })

    /**
     * 🔴 **自由函式那一形要被記住，不能靠猜**——原生陣列沒有成員 `begin`，
     * 產成 `a.begin()` 的話**編不過**。
     */
    it('🔴 `begin(a)` 的 `call` 屬性要是 `free`，而 `v.begin()` 要是 `method`', () => {
      const dig = (n: SemanticNode, acc: SemanticNode[] = []): SemanticNode[] => {
        if (n.componentId === 'cpp:container_iter') acc.push(n)
        for (const ks of Object.values(n.slots ?? {})) for (const k of ks) dig(k, acc)
        return acc
      }
      const free = dig(lift(wrap('  sort(begin(a), end(a));')))
      expect(free.length).toBe(2)
      expect(free.every((x) => x.properties.call === 'free')).toBe(true)

      const method = dig(lift(wrap('  sort(v.begin(), v.end());')))
      expect(method.length).toBe(2)
      expect(method.every((x) => x.properties.call === 'method')).toBe(true)
    })
  })
})
