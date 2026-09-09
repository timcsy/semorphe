/**
 * **第一百一十六條護欄：逗號有一顆積木，而它在兩個位置都在。**
 *
 * ## 🔴 它從哪裡來
 *
 * 2026-09-09，拿學生的競賽練習當語料（218 個 `.cpp`）量到逗號運算式出現
 * **140 次**，而它**沒有積木形態**——`forms/blocks.json` 是 `[]`，
 * `skipReasons.render` 寫著 `consumed-by-parent`。
 *
 * ⚠️ 而那句話只在一個位置成立：
 *
 * ```
 * 語句位置        138 次   父節點是 body，沒有人吃它
 * for 的更新格      2 次   ✅ 這裡才真的有父節點
 * 值的位置          0 次
 * ```
 *
 * > **一個「由父節點吃掉」的宣告，要說得出【是哪一個父節點】
 * > ——否則它在沒有那個父節點的位置就是一句沒有人檢查的話。**
 *
 * 🔴 **使用者拍板做這顆積木，理由是兩根指標的迴圈**：
 * `for (int a = 0, b = n; a < b; a++, b--)` 是 AP325 的常見技巧，
 * 而在此之前那個迴圈的第一格與第三格是兩個打不開的黑盒。
 *
 * ## ⚠️ 為什麼要兩個形態
 *
 * 這顆的 `role` 是 `expression`。**只給運算式版的話，語句位置的那 138 筆
 * 會從畫布上消失**——`renderStatementChain` 明文跳過接不進語句串的積木。
 * 那比黑盒更糟：黑盒至少看得見。
 *
 * ## 本護欄不檢測什麼
 *
 * - 🪦 **不驗「產出逐字相同」**——那由第一百一十五條守。
 * - ⚠️ **不驗 `for (i = 0, …)`（賦值當初始）整條無黑盒**：`cpp:var_assign`
 *   沒有運算式形態，而**那與逗號無關**（`for (i = 0; …)` 今天本來就是黑盒）。
 *   那是另一刀，記在報告裡。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { renderToBlocklyState } from '../../src/core/projection/block-renderer'
import { PatternRenderer } from '../../src/core/projection/pattern-renderer'
import { PatternExtractor } from '../../src/core/projection/pattern-extractor'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { RenderStrategyRegistry } from '../../src/core/registry'
import { registerCppRenderStrategies } from '../../src/languages/cpp/renderers/strategies'
import { registerCppExtractStrategies } from '../../src/languages/cpp/extractors/extract-strategies'
import { allComponentDefs } from '../helpers/component-scan'
import { allCppProjections } from '../../src/languages/cpp/all-declarations'
import { setupTestRenderer } from '../helpers/setup-renderer'
import { declareDegradationBlocks, setDegradationLanguage } from '../../src/core/degradation-blocks'
import type { SemanticNode } from '../../src/core/types'
import type { BlockState } from '../../src/core/registry/render-strategy-registry'

let parser: Parser
let renderer: PatternRenderer
let extractor: PatternExtractor

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
  setupTestRenderer()
  declareDegradationBlocks('cpp', { statement: 'cpp_raw_code', expression: 'cpp_raw_expression' })
  setDegradationLanguage('cpp')

  // ⚠️ **積木投影走唯一組裝點**——手列 registrar 的測試會漏掉膠囊那一批。
  const reg = new BlockSpecRegistry()
  reg.loadFromSplit(allComponentDefs(), allCppProjections())
  const rsr = new RenderStrategyRegistry()
  registerCppRenderStrategies(rsr)
  renderer = new PatternRenderer()
  renderer.setRenderStrategyRegistry(rsr)
  renderer.loadBlockSpecs(reg.getAll())
  extractor = new PatternExtractor()
  extractor.loadBlockSpecs(reg.getAll())
  registerCppExtractStrategies(extractor)
}, 120_000)

/** 語義指紋——身分 ＋ 屬性 ＋ 接點，丟掉位置與排版。 */
function fingerprint(n: SemanticNode | null | undefined): string {
  if (!n) return '∅'
  const props = Object.entries(n.properties ?? {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${String(v)}`).join(',')
  const kids = Object.entries(n.children ?? {}).sort(([a], [b]) => a.localeCompare(b))
    .map(([k, arr]) => `${k}[${(arr ?? []).map(fingerprint).join('|')}]`).join('')
  return `(${n.componentId}${props ? ' ' + props : ''}${kids})`
}

/** 那一句的語義節點（跳過前面的變數宣告與 main 的外殼）。 */
function statementOf(body: string): SemanticNode {
  const tree = parser.parse(`int i, j, n;\nint main() {\n${body}\n}`)
  const root = createTestLifter().lift(tree!.rootNode as never) as SemanticNode
  return root.children.body![1].children.body![0]
}

/** 這段程式碼投影成積木之後，出現了哪些積木型別。 */
function blockTypes(body: string): Set<string> {
  const tree = parser.parse(`int i, j, n;\nint main() {\n${body}\n}`)
  if (!tree) return new Set()
  const root = createTestLifter().lift(tree.rootNode as never) as SemanticNode
  const out = new Set<string>()
  const walk = (o: unknown): void => {
    if (!o || typeof o !== 'object') return
    const r = o as Record<string, unknown>
    if (typeof r.type === 'string') out.add(r.type)
    for (const v of Object.values(r)) {
      if (Array.isArray(v)) v.forEach(walk)
      else walk(v)
    }
  }
  walk(renderToBlocklyState(root))
  return out
}

describe('第一百一十六條護欄：逗號的積木', () => {
  it('★ 入口條件——投影真的跑得動', () => {
    expect(blockTypes('    i = 1;').has('cpp_var_assign')).toBe(true)
  })

  /**
   * 🔴 **競賽 C++ 的第一行——語料裡 218 個檔中的 136 個。**
   *
   * ⚠️ 逗號積木做好之後它**還不夠**：`cpp:io_sync` 與 `cpp:io_tie` 那時只有
   * 敘述形態，而逗號的插槽收的是**運算式**——於是那一行變成
   * `依序 [直接寫運算式] [直接寫運算式]`：看得見，而拆不開。
   *
   * 🟢 兩顆各補一個運算式形態之後，整行都是真積木（使用者拍板：「補」）。
   */
  it('🔴 競賽模板那一行：整行都是真積木，零黑盒', () => {
    const t = blockTypes('    ios::sync_with_stdio(0), cin.tie(0);')
    expect(t.has('cpp_comma_expr'), '🔴 語句位置的逗號不見了或退成黑盒').toBe(true)
    expect(t.has('cpp_raw_code'), '🔴 整行還是一顆黑盒——積木沒有生效').toBe(false)
    expect(
      t.has('cpp_raw_expression'),
      '🔴 逗號的插槽裡還有黑盒——那兩顆缺運算式形態',
    ).toBe(false)
    expect(t.has('cpp_io_sync_expression')).toBe(true)
    expect(t.has('cpp_io_tie_expression')).toBe(true)
  })

  /** ★ **敘述位置仍然用敘述形態**——多一個形態不得把原來那個擠掉。 */
  it.each([
    ['    ios::sync_with_stdio(0);', 'cpp_io_sync'],
    ['    cin.tie(0);', 'cpp_io_tie'],
  ])('★ 單獨一句時仍是敘述形態：%s', (body, id) => {
    const t = blockTypes(body)
    expect(t.has(id), `🔴 ${id} 被運算式形態擠掉了`).toBe(true)
    expect(t.has(`${id}_expression`), '🔴 敘述位置用了運算式形態').toBe(false)
  })

  /** 🔴 **這一條就是使用者要這顆積木的理由。** */
  it('🔴 兩根指標的迴圈：三格全部是真積木，零黑盒', () => {
    const t = blockTypes('    for (int a = 0, b = n; a < b; a++, b--) {\n    }')
    expect(t.has('cpp_comma_expr_expression'), '🔴 for 的三格裝不下逗號').toBe(true)
    expect(
      t.has('cpp_raw_expression'),
      '🔴 迴圈裡還有黑盒——兩根指標的迴圈是這顆積木存在的理由，\n'
        + '   它整條都要拆得開。',
    ).toBe(false)
  })

  /**
   * 🔴 **三個運算元是【一顆積木三格】，不是兩顆巢狀的。**
   *
   * tree-sitter 把 `a, b, c` 解析成 `comma(a, comma(b, c))`——那是文法的結合律，
   * 不是語義。而這顆積木是變長的（學生按 `+` 加第三格），所以不拉平的話：
   *
   * ```
   * 學生按 +  → 一顆積木三格 → 產出 a, b, c → 同步回來 → 兩顆巢狀的積木
   * ```
   *
   * > **一個「結合律不影響語義」的地方，如果投影記得那個結合方式，
   * > 使用者就會看到他沒有做過的改動。**
   */
  it('🔴 三個運算元：一顆積木三格，一個都沒掉', () => {
    const n = statementOf('    i++, j--, n++;')
    expect(n.componentId).toBe('cpp:comma_expr')
    expect(
      (n.children.exprs ?? []).length,
      '🔴 三個運算元沒有拉平——學生按 `+` 加的那一格，同步一趟就裂成兩顆積木',
    ).toBe(3)
    expect(
      (n.children.exprs ?? []).some((c) => c.componentId === 'cpp:comma_expr'),
      '🔴 裡面還巢著一顆逗號',
    ).toBe(false)
    expect(blockTypes('    i++, j--, n++;').has('cpp_comma_expr')).toBe(true)
  })

  // ─── 注入（第四十九條）───

  it('★ 注入：拿掉一個形態 → 這條護欄會紅', () => {
    // 語句版與運算式版是**兩個不同的型別名**——只有一個的話上面兩條必有一條紅
    expect(blockTypes('    ios::sync_with_stdio(0), cin.tie(0);').has('cpp_comma_expr_expression')).toBe(false)
    expect(blockTypes('    for (int a = 0, b = n; a < b; a++, b--) {\n    }').has('cpp_comma_expr')).toBe(false)
  })

  it('★ 反向：沒有逗號的程式不得長出逗號積木', () => {
    const t = blockTypes('    for (int a = 0; a < n; a++) {\n    }')
    expect([...t].filter((x) => x.includes('comma'))).toEqual([])
  })
  // ─── 🔴 另一半：積木 → 語義（學生自己拖出這顆積木之後）───

  /**
   * 🔴 **只驗 render 的護欄會漏掉一半。**
   *
   * 這一條比對的是**語義指紋**，不是產出的字串——一顆身分不對而字串剛好相同的
   * 積木，在字串比對下是綠的。
   *
   * > **roundtrip 測試必須驗證語義樹用的是正確的身分，不能只驗輸出字串。**
   */
  it.each([
    '    i++, j--;',
    '    i++, j--, n++;',
    '    ios::sync_with_stdio(0), cin.tie(0);',
  ])('🔴 積木 → 語義：%s 走一趟回來是同一棵', (body) => {
    const before = statementOf(body)
    const block = renderer.render(before)
    expect(block, '🔴 渲染不出積木').not.toBeNull()
    const after = extractor.extract(block!)
    expect(
      fingerprint(after),
      '🔴 積木走回語義之後不是同一棵——學生動了積木，他的程式就變了。',
    ).toBe(fingerprint(before))
  })

  /**
   * 🔴 **兩根指標的迴圈，Blockly 真的建得起來嗎。**
   *
   * ⚠️ 上面那幾條驗的是 **BlockState（JSON）**——它對「Blockly 建不建得起來」
   * 一個字都沒說（第五十一條護欄的檔頭記著這句）。
   *
   * 2026-09-09 **開瀏覽器實測**抓到：那個迴圈的第一格
   * （`int a = 0, b = n`，兩個宣告子）讓整個工作區載入失敗：
   *
   * ```
   * 積木載入失敗：cpp_var_declare_expression is missing a(n) INIT_1 connection
   * ```
   *
   * 真因是**既有的**：那顆積木的宣告只有寫死的 `NAME_0`／`INIT_0`，
   * 沒有 `paramList`——而渲染那一路老實地吐出了 `INIT_1`。
   *
   * > **兩個形態的宣告，只有一邊補得完整時，
   * > 另一邊會在【使用者拖到它】的那天壞掉。**
   */
  it('🔴 兩根指標的第一格：兩個宣告子都要出現在積木狀態裡', () => {
    const tree = parser.parse('int n;\nint main() {\n  for (int a = 0, b = n; a < b; a++, b--) {\n  }\n}')
    const root = createTestLifter().lift(tree!.rootNode as never) as SemanticNode
    const state = JSON.stringify(renderToBlocklyState(root))
    for (const k of ['NAME_0', 'NAME_1', 'INIT_0', 'INIT_1']) {
      expect(state.includes(k), `🔴 積木狀態裡沒有 ${k}——第二個宣告子掉了`).toBe(true)
    }
  })

  /**
   * ★ **抽取那一側也要讀得到第二個宣告子。**
   *
   * 🔴 在此之前 `cpp_var_declare_expression` 的抽取策略只讀 `NAME_0`／`INIT_0`
   * ——就算積木建得起來，學生一動它，`b = n` 就沒了。
   */
  it('🔴 兩根指標的第一格：抽取回來還是兩個宣告子', () => {
    const tree = parser.parse('int n;\nint main() {\n  for (int a = 0, b = n; a < b; a++, b--) {\n  }\n}')
    const root = createTestLifter().lift(tree!.rootNode as never) as SemanticNode
    // ⚠️ **要走 `renderToBlocklyState`**：`PatternRenderer.render` 直接叫的話
    //    帶策略的節點（`cpp:renderVarDeclare`）不會被套用，吐出來是一顆空積木。
    const state = renderToBlocklyState(root)
    const found: BlockState[] = []
    const walk = (o: unknown): void => {
      if (!o || typeof o !== 'object') return
      const r = o as Record<string, unknown>
      // ⚠️ 型別是 `cpp_var_declare_expression`——運算式位置會換成對應形態
      if (typeof r.type === 'string' && r.type.startsWith('cpp_var_declare')
        && r.fields && (r.fields as Record<string, unknown>).NAME_1 !== undefined) {
        found.push(o as BlockState)
      }
      for (const v of Object.values(r)) { if (Array.isArray(v)) v.forEach(walk); else walk(v) }
    }
    walk(state)
    expect(found.length, '🔴 找不到那顆兩個宣告子的積木').toBeGreaterThan(0)
    const back = extractor.extract(found[0])
    expect(
      (back?.children.declarators ?? []).length,
      '🔴 抽取回來只剩一個宣告子——學生動了積木，`b = n` 就不見了',
    ).toBe(2)
  })
})
