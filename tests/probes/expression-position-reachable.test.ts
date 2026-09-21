/**
 * @vitest-environment happy-dom
 *
 * **探針：那八顆「宣告說得出而形態沒做」的元件，運算式位置今天長什麼樣**
 *
 * 第一百二十六條護欄落地時掃出 8 顆，而它的檔頭說每一顆有兩種修法：
 * **補形態**（那個位置真的會出現）或**改宣告**（寫寬了）。
 *
 * 🔴 查過八顆的 `_positions_why` 之後，**「改宣告」對八顆都不成立**
 * ——每一條寫的都是**文法**上的理由（`a = b` 回傳左值 · `v.erase(it)` 回傳
 * iterator · `cout << x` 回傳 `ostream&`），而 `positions` 就是文法。
 *
 * 所以要問的是第三個問題：
 *
 * > **文法上放得進去 ≠ 我們的 lift 真的會把它放進去，
 * > 而「lift 放得進去」≠ 渲染那一側畫得出來。**
 *
 * ## ⚠️ 判準：每一顆都要有【語句位置】那一欄當錨點
 *
 * 🔴 第一版沒有，而它整批報「畫不出來」——**包括語句位置**。
 * 那不可能（`cout << 1;` 在應用裡顯然畫得出來），真相是這支探針
 * **沒有把渲染那一套註冊起來**（`BlockRegistrar` ＋ `PatternRenderer`）。
 *
 * > **一份「有 N 個缺陷」的報告，先問那 N 裡有幾個是量測工具自己的。**
 *
 * ⚠️ **這支不是護欄**：它產出的是一份讀數，用來逐顆決定補不補形態。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import * as Blockly from 'blockly'
import { Parser, Language } from 'web-tree-sitter'
import { registerFieldMultilineInput } from '@blockly/field-multilineinput'
import { registerDynamicDropdownField, declareDropdownSource } from '../../src/ui/dynamic-dropdown-field'
import { BlockSpecRegistry } from '../../src/core/blocks/block-spec-registry'
import { allCppProjections } from '../../src/languages/cpp/all-declarations'
import { allComponentDefs } from '../helpers/component-scan'
import { componentLabels } from '../../src/core/component/labels'
import i18nBlocks from '../../src/i18n/zh-TW/blocks.json'
import { createTestLifter } from '../helpers/setup-lifter'
import { PatternRenderer } from '../../src/core/projection/pattern-renderer'
import { RenderStrategyRegistry } from '../../src/core/registry'
import { registerCppRenderStrategies } from '../../src/languages/cpp/renderers/strategies'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { renderToBlocklyState, setPatternRenderer } from '../../src/core/projection/block-renderer'
import { setDegradationLanguage } from '../../src/core/blocks/degradation-blocks'
import { printReport } from '../helpers/guardrail'
import type { SemanticNode } from '../../src/core/types'

let parser: Parser

beforeAll(async () => {
  registerFieldMultilineInput()
  registerDynamicDropdownField()
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

  registerCppLanguage()
  const rsr = new RenderStrategyRegistry()
  registerCppRenderStrategies(rsr)
  const renderer = new PatternRenderer()
  renderer.setRenderStrategyRegistry(rsr)
  renderer.loadBlockSpecs(reg.getAll())
  setPatternRenderer(renderer)
  setDegradationLanguage('cpp')

  await Parser.init({ locateFile: (f: string) => `${process.cwd()}/public/${f}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
}, 180_000)

/** 一段程式渲染之後有哪些積木型別。 */
function blockTypes(src: string): string[] {
  const tree = createTestLifter().lift(parser.parse(src)!.rootNode as never) as SemanticNode | null
  if (tree === null) return ['(lift 回 null)']
  const out: string[] = []
  const walk = (o: unknown): void => {
    if (o === null || typeof o !== 'object') return
    const r = o as Record<string, unknown>
    if (typeof r.type === 'string') out.push(r.type)
    for (const v of Object.values(r)) { if (Array.isArray(v)) v.forEach(walk); else walk(v) }
  }
  walk(renderToBlocklyState(tree))
  return out
}

/** 八顆各一對：**語句位置**（錨點）與**運算式位置**。 */
const PAIRS: { block: string; stmt: string; expr: string }[] = [
  { block: 'cpp_var_assign',
    stmt: 'int main(){ int x,y; x = y; }',
    expr: 'int main(){ int x,y; while ((x = y) != 0) { y = 0; } }' },
  { block: 'cpp_array_assign',
    stmt: 'int main(){ int a[3],v; a[0] = v; }',
    expr: 'int main(){ int a[3],v; while ((a[0] = v) != 0) { v = 0; } }' },
  { block: 'cpp_array_2d_assign',
    stmt: 'int main(){ int g[2][2],v; g[0][0] = v; }',
    expr: 'int main(){ int g[2][2],v; while ((g[0][0] = v) != 0) { v = 0; } }' },
  { block: 'cpp_map_assign',
    stmt: '#include <map>\nint main(){ std::map<int,int> m; m[1] = 2; }',
    expr: '#include <map>\nint main(){ std::map<int,int> m; if ((m[1] = 2) > 0) { } }' },
  { block: 'cpp_container_erase',
    stmt: '#include <vector>\nint main(){ std::vector<int> v; auto it=v.begin(); v.erase(it); }',
    expr: '#include <vector>\nint main(){ std::vector<int> v; auto it=v.begin(); it = v.erase(it); }' },
  { block: 'cpp_print',
    stmt: '#include <iostream>\nint main(){ std::cout << 1; }',
    expr: '#include <iostream>\nint main(){ (std::cout << 1), (std::cout << 2); }' },
  // ⚠️ 這兩顆的語義我一開始搞反了：`push_back` 是 **append**，
  //    而 `container_push` 是 stack／queue 的 `.push()`（看它們的標籤鍵就知道）。
  { block: 'cpp_container_push',
    stmt: '#include <stack>\nint main(){ std::stack<int> st; st.push(1); }',
    expr: '#include <stack>\nint main(){ std::stack<int> st; int i=0; for (; i<3; st.push(i), i++) { } }' },
  { block: 'cpp_container_append',
    stmt: '#include <vector>\nint main(){ std::vector<int> v; v.push_back(1); }',
    expr: '#include <vector>\nint main(){ std::vector<int> v; int i=0; for (; i<3; v.push_back(i), i++) { } }' },
]

const HATCH = /raw_code|raw_expression|unresolved/

describe('探針：八顆元件在運算式位置畫得出來嗎', () => {
  it('量一次', () => {
    const rows: string[] = []
    let anchorsOk = 0
    for (const p of PAIRS) {
      const s = blockTypes(p.stmt), e = blockTypes(p.expr)
      const has = (a: string[]): boolean => a.some((t) => t.startsWith(p.block))
      const hatch = (a: string[]): number => a.filter((t) => HATCH.test(t)).length
      if (has(s)) anchorsOk++
      rows.push(`  ${p.block}`)
      rows.push(`     語句位置（錨點） ${has(s) ? '🟢 有' : '🔴 沒有 ← 探針壞了'}  灰塊 ${hatch(s)}`)
      rows.push(`     運算式位置       ${has(e) ? '🟢 有' : '🔴 沒有'}  灰塊 ${hatch(e)}`)
    }
    printReport('八顆元件：語句位置 vs 運算式位置', [
      '🔴 錨點（語句位置）沒有 ⟹ **這支探針壞了**，那一列的讀數不算數',
      '',
      ...rows,
    ])
    // ★ 自我否證：錨點全倒 ⟹ 是量測工具壞了，不是產品壞了
    expect(anchorsOk, '🔴 一個錨點都沒立起來 → 渲染那一套沒註冊好').toBeGreaterThan(4)
  })
})
