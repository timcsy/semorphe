/**
 * **前置宣告的參數，名字與預設值都不准掉。**
 *
 * ## 它從哪來（2026-08-26，退 `cpp_forward_decl` 的命令式定義時量到的）
 *
 * 那顆積木的命令式定義用 `withNameField: false`——每格參數**只有型別下拉**，
 * 而它的註解寫著「前向宣告不需要名字」。那句話對 C++ 文法成立，
 * **對這個系統不成立**：
 *
 * ```
 * 語義樹   param_decl 帶著 type / name / default
 * 抬升     讀得到                       ← 而它漏了帶預設值的那個節點型別
 * 產生器   印得出 name                  ← 而它不印 default
 * 積木     【收不下 name，也收不下 default】
 * ```
 *
 * **三段路，三個缺陷，而它們互相遮蔽**：積木收不下名字，所以沒有人會發現
 * 產生器不印預設值；產生器不印預設值，所以沒有人會發現抬升根本沒帶進來。
 *
 * > **一條路上有兩個缺陷時，下游那個會讓上游那個看起來不存在。**
 *
 * ## 🔴 為什麼既有的測試看不到
 *
 * `roundtrip-cpp-advanced-features` 有 `int add(int a, int b);` 的來回測試，
 * **而它走的是「碼 → 樹 → 碼」**——積木不在那條路上。
 * 比對護欄那天說這兩份定義「一模一樣」，因為**參數欄位只在載入時才長出來**，
 * 而它只比「剛建好的樣子」。
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測積木上的標籤文字**——沒有任何測試在看標籤（要開瀏覽器）
 * - **不檢測函式定義那顆**（`cpp:func_def`）——它 2026-08-23 就修好了，
 *   而**這一顆是抄過去的那一份，沒有跟著修**
 */
import { describe, it, expect, beforeAll } from 'vitest'
import * as Blockly from 'blockly'
import { Parser, Language } from 'web-tree-sitter'
import { registerFieldMultilineInput } from '@blockly/field-multilineinput'
import { registerDynamicDropdownField, declareDropdownSource } from '../../src/ui/dynamic-dropdown-field'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { allCppProjections } from '../../src/languages/cpp/all-declarations'
import { allComponentDefs } from '../helpers/component-scan'
import { componentLabels } from '../../src/core/component/labels'
import i18nBlocks from '../../src/i18n/zh-TW/blocks.json'
import { renderToBlocklyState, setPatternRenderer } from '../../src/core/projection/block-renderer'
import { PatternRenderer } from '../../src/core/projection/pattern-renderer'
import { RenderStrategyRegistry } from '../../src/core/registry'
import { registerCppRenderStrategies } from '../../src/languages/cpp/renderers/strategies'
import { createTestLifter } from '../helpers/setup-lifter'
import { setDegradationLanguage } from '../../src/core/degradation-blocks'
import { generateCode } from '../../src/core/projection/code-generator'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

let reg: BlockSpecRegistry
let ws: Blockly.Workspace
let parser: Parser
let lifter: ReturnType<typeof createTestLifter>

const style = apcs as unknown as StylePreset

/** 一段碼 → 語義樹。 */
function lift(code: string): SemanticNode {
  const t = parser.parse(code)
  expect(t, `解析不出來：${code}`).not.toBeNull()
  const tree = lifter.lift(t!.rootNode as never)
  expect(tree, `抬升不出來：${code}`).not.toBeNull()
  return tree as SemanticNode
}

/** 樹裡那顆前置宣告的參數。 */
function paramsOf(tree: SemanticNode): SemanticNode[] {
  const found: SemanticNode[] = []
  const walk = (n: SemanticNode): void => {
    if (n.componentId === 'cpp:forward_decl') found.push(...(n.children.params ?? []))
    for (const kids of Object.values(n.children ?? {})) for (const k of kids) walk(k)
  }
  walk(tree)
  return found
}

/** 樹 → 積木狀態 → **真的建進工作區** → 那顆前置宣告積木。 */
function blockFor(tree: SemanticNode): Blockly.Block {
  const { blockMappings: _drop, ...state } = renderToBlocklyState(tree as never)
  const load = new Blockly.Workspace()
  Blockly.serialization.workspaces.load(state, load)
  const b = load.getAllBlocks(false).find((x) => x.type === 'cpp_forward_decl')
  expect(b, '工作區裡沒有 cpp_forward_decl —— 積木根本沒建出來').toBeTruthy()
  return b!
}

beforeAll(async () => {
  registerFieldMultilineInput()
  registerDynamicDropdownField()
  for (const k of ['names', 'vars', 'funcs', 'arrays']) declareDropdownSource(k, () => [])
  // 🔴 **語言套件要真的載進來**——`cpp_param_types`／`cpp_return_types` 是
  //    它在模組層級登記的。少了它，宣告式的下拉會拋「來源沒註冊」，
  //    而那個錯看起來像宣告寫壞了（`retire-imperative-block` §2.5）。
  await import('../../src/languages/cpp/pack')
  Object.assign(Blockly.Msg as Record<string, string>, i18nBlocks, componentLabels('zh-TW'))

  reg = new BlockSpecRegistry()
  reg.loadFromSplit(allComponentDefs(), allCppProjections())
  ws = new Blockly.Workspace()

  const { BlockRegistrar } = await import('../../src/ui/block-registrar')
  new BlockRegistrar(reg).registerAll({ getWorkspace: () => ws })

  const rsr = new RenderStrategyRegistry()
  registerCppRenderStrategies(rsr)
  const renderer = new PatternRenderer()
  renderer.setRenderStrategyRegistry(rsr)
  renderer.loadBlockSpecs(reg.getAll())
  setPatternRenderer(renderer)
  setDegradationLanguage('cpp')
  registerCppLanguage()

  await Parser.init({ locateFile: (f: string) => `${process.cwd()}/public/${f}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
}, 120_000)

describe('前置宣告的參數不准掉', () => {
  it('★ 錨點：這顆積木真的建得起來，而且是宣告式那一份', () => {
    // ⚠️ 沒有這一支的話，下面每一句「欄位在」都可能是在問一個沒建出來的東西。
    expect(Blockly.Blocks['cpp_forward_decl'], '積木沒註冊 → 下面全部不算數').toBeTruthy()
    const b = ws.newBlock('cpp_forward_decl')
    const fields = b.inputList.flatMap((i) => i.fieldRow.map((f) => f.name)).filter(Boolean)
    expect(fields, '剛建好就該有回傳型別與名字').toEqual(expect.arrayContaining(['RETURN_TYPE', 'NAME']))
    b.dispose(false)
  })

  it('🔴 抬升：帶預設值的參數【不得整格消失】', () => {
    // 🪦 修好前：`optional_parameter_declaration` 這個節點型別在這條路上沒有分支，
    //    於是 `int b = 10` 整格被跳過——語義樹裡只有一個參數。
    //    ⚠️ 而一模一樣的修法 2026-08-23 就做在 `liftParamList` 上（函式定義那顆）。
    const ps = paramsOf(lift('int add(int a, int b = 10);'))
    expect(ps.map((p) => `${p.properties.type} ${p.properties.name}`),
      '帶預設值的那一格被整格跳過了').toEqual(['int a', 'int b'])
    expect(ps[1]?.properties.default, '預設值沒被帶進語義樹').toBe('10')
  })

  it('🔴 產生器：預設值要印出來——少了它，`add(1)` 編不過', () => {
    expect(generateCode(lift('int add(int a, int b = 10);'), 'cpp', style).trim())
      .toBe('int add(int a, int b = 10);')
  })

  it('🔴 積木：參數的名字收得下——不然來回一趟變成 `int add(int, int);`', () => {
    const b = blockFor(lift('int add(int a, int b);'))
    expect(b.getFieldValue('TYPE_0')).toBe('int')
    expect(b.getFieldValue('PARAM_0'), '參數名字掉了').toBe('a')
    expect(b.getFieldValue('TYPE_1')).toBe('int')
    expect(b.getFieldValue('PARAM_1'), '第二個參數名字掉了').toBe('b')
  })

  it('🔴 積木：預設值那一格也收得下', () => {
    const b = blockFor(lift('int add(int a, int b = 10);'))
    expect(b.getFieldValue('PARAM_DEFAULT_1'), '預設值在積木上沒有落點').toBe('10')
    // ⚠️ **留空 ＝ 沒有預設值**，不是「還沒填」——與函式定義那顆同一條。
    expect(b.getFieldValue('PARAM_DEFAULT_0'), '沒有預設值的那一格不該被塞東西').toBe('')
  })

  it('★ 沒有名字的前置宣告仍然合法——`int add(int, int);` 不得被塞進假名字', () => {
    // C++ 允許省略參數名，而**省略與遺失是兩件事**：
    // 這一支釘住「省略」那一邊，否則上面幾支可能被一個「一律填 p0」的實作騙過去。
    const ps = paramsOf(lift('int add(int, int);'))
    expect(ps.map((p) => p.properties.name), '省略的名字被補了東西進去').toEqual(['', ''])
    expect(generateCode(lift('int add(int, int);'), 'cpp', style).trim()).toBe('int add(int, int);')
  })
})
