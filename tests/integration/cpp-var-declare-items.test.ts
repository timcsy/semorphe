/**
 * **一顆積木的每一格，形態各自不同。**
 *
 * ## 它從哪來（2026-08-26，命令式積木退場計畫的最後一顆）
 *
 * `int x = 1, y, z = 3;` 是**三格三種形態**：有初始值／沒有／有。
 * 命令式那份用 `{ items: ('var_init'|'var')[] }` ＋ `rebuildInputs_` 做到它，
 * 而宣告式的兩個建構子當時都表達不完：
 *
 * ```
 * variadic   每一格同形（只加得了文字前綴）
 * paramList  每格有欄位、有齒輪開關的「選用群」——而那個群只建得出【啞輸入】
 * ```
 *
 * 補了三格參數（`valueInput.replacesItem`／`itemsAs`／`defaultOpen`）之後表達得完。
 *
 * ## 🔴 這支釘住的是**存檔契約**，不只是畫面
 *
 * `itemsAs` 讓存檔照舊寫成 `{ items: [...] }`——**那是既有的形狀，
 * 而用它原本的形狀寫就不必遷移**。換一個鍵名等於讓使用者的檔案打不開。
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測標籤文字與版面**——沒有任何測試在看標籤（要開瀏覽器）
 * - **不檢測齒輪那個對話框**——這裡直接呼叫 `setOptional_`，
 *   而使用者是從齒輪裡拖子積木。兩者共用同一個 `compose` 路徑。
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
import type { SemanticNode } from '../../src/core/types'

let reg: BlockSpecRegistry
let ws: Blockly.Workspace
let parser: Parser
let lifter: ReturnType<typeof createTestLifter>

function lift(code: string): SemanticNode {
  const t = parser.parse(code)
  expect(t, `解析不出來：${code}`).not.toBeNull()
  const tree = lifter.lift(t!.rootNode as never)
  expect(tree, `抬升不出來：${code}`).not.toBeNull()
  return tree as SemanticNode
}

/** 樹 → 積木狀態 → **真的建進工作區** → 那顆宣告積木。 */
function blockFor(code: string): { block: Blockly.Block; ws: Blockly.Workspace } {
  const { blockMappings: _drop, ...state } = renderToBlocklyState(lift(code) as never)
  const load = new Blockly.Workspace()
  Blockly.serialization.workspaces.load(state, load)
  const b = load.getAllBlocks(false).find((x) => x.type === 'cpp_var_declare')
  expect(b, `工作區裡沒有 cpp_var_declare：${code}`).toBeTruthy()
  return { block: b!, ws: load }
}

const slots = (b: Blockly.Block): string[] => b.inputList.map((i) => i.name).filter(Boolean) as string[]

beforeAll(async () => {
  registerFieldMultilineInput()
  registerDynamicDropdownField()
  for (const k of ['names', 'vars', 'funcs', 'arrays']) declareDropdownSource(k, () => [])
  // 🔴 語言套件要真的載進來——`cpp_var_types` 是它在模組層級登記的
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

  await Parser.init({ locateFile: (f: string) => `${process.cwd()}/public/${f}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
}, 120_000)

describe('宣告的每一格，形態各自不同', () => {
  it('★ 錨點：這顆積木建得起來，而且新的一格預設是「有初始值」', () => {
    // ⚠️ 沒有這一支，下面每一句「形態對」都可能是在問一個沒建出來的東西。
    expect(Blockly.Blocks['cpp_var_declare'], '積木沒註冊 → 下面全部不算數').toBeTruthy()
    const b = ws.newBlock('cpp_var_declare')
    // 🔴 命令式那份的預設是 `['var_init']`——新宣告一個變數通常就是要給它值
    expect(b.saveExtraState?.()).toEqual({ items: ['var_init'] })
    expect(b.getFieldValue('NAME_0'), '第一格的預設名字是 x，不是 v0').toBe('x')
    b.dispose(false)
  })

  it('🔴 三格三種形態——插槽的【種類】要跟著形態走', () => {
    const { block, ws: w } = blockFor('int main() { int x = 1, y, z = 3; }')
    // `INIT_i` 是接點（有初始值），`VAR_i` 是啞輸入（沒有）——never both
    expect(slots(block)).toEqual(['HEADER', 'INIT_0', 'VAR_1', 'INIT_2', 'TAIL'])
    expect([0, 1, 2].map((i) => block.getFieldValue(`NAME_${i}`))).toEqual(['x', 'y', 'z'])
    w.dispose()
  })

  it('🔴 存檔契約：照舊寫成 `{ items: [...] }`——換一個鍵名等於讓舊檔打不開', () => {
    const { block, ws: w } = blockFor('int main() { int x = 1, y, z = 3; }')
    expect(block.saveExtraState?.()).toEqual({ items: ['var_init', 'var', 'var_init'] })
    w.dispose()
  })

  it('🔴 舊存檔載得回來——而且每一格的形態一格不差', () => {
    // ⚠️ 這是**沒有遷移**的證明：這份狀態就是命令式那份存出來的形狀。
    const old = {
      type: 'cpp_var_declare',
      extraState: { items: ['var', 'var_init'] },
      fields: { TYPE: 'double', NAME_0: 'a', NAME_1: 'b' },
      inputs: { INIT_1: { block: { type: 'cpp_literal_number', fields: { NUM: '7' } } } },
    }
    const w = new Blockly.Workspace()
    const b = Blockly.serialization.blocks.append(old as never, w)
    expect(slots(b)).toEqual(['HEADER', 'VAR_0', 'INIT_1', 'TAIL'])
    expect(b.getFieldValue('TYPE')).toBe('double')
    expect([0, 1].map((i) => b.getFieldValue(`NAME_${i}`))).toEqual(['a', 'b'])
    expect(b.getInput('INIT_1')?.connection?.targetBlock()?.type).toBe('cpp_literal_number')
    w.dispose()
  })

  it('🔴 齒輪切形態時，接上去的積木要【寄放】起來——再打開它會回來', () => {
    // 🪦 第一版只 `disconnect()`：那顆 `1` **浮成工作區裡的一顆孤兒積木**，
    //    而再打開時是 `x = ?`。命令式那份更糟——`removeInput` 直接把它 dispose 掉。
    //    > **一個救不回來的動作，不該藏在一個勾選格後面。**
    const { block, ws: w } = blockFor('int main() { int x = 1; }')
    const b = block as Blockly.Block & { setOptional_: (i: number, k: string, v: boolean) => void }
    expect(b.getInput('INIT_0')?.connection?.targetBlock()?.toString()).toBe('1')

    b.setOptional_(0, 'init', false)
    expect(slots(b), '關掉之後那一格要變成啞輸入').toEqual(['HEADER', 'VAR_0', 'TAIL'])
    expect(w.getTopBlocks(false).length, '🔴 那顆積木浮成孤兒了').toBe(1)

    b.setOptional_(0, 'init', true)
    expect(slots(b)).toEqual(['HEADER', 'INIT_0', 'TAIL'])
    expect(b.getInput('INIT_0')?.connection?.targetBlock()?.toString(), '那顆積木沒有回來').toBe('1')
    w.dispose()
  })

  it('★ 沒有初始值的宣告仍然是一格——`int x;` 不得被塞一個空接點', () => {
    // 「省略」與「遺失」是兩件事——這一支釘住省略那一邊。
    const { block, ws: w } = blockFor('int main() { int n; }')
    expect(slots(block)).toEqual(['HEADER', 'VAR_0', 'TAIL'])
    expect(block.saveExtraState?.()).toEqual({ items: ['var'] })
    w.dispose()
  })
})
