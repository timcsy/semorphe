/**
 * 第 411 刀：**迴圈與推導式綁定的名字，走一趟真的積木回來還在不在**。
 *
 * `for c in s:` 走一趟積木回來曾經變成 `for i in s:`（2026-08-21 起），而迴圈體還在讀 `c`：
 * 單一名字只寫在 `obj`，而積木只認 `targets`（paramList 的 `PARAM_{i}`），於是積木上那一格是預設的 `i`。
 * 程式碼那一路（lift → generate）一直是綠的——**只在積木那一條投影上壞掉的缺陷，不經過那條投影的測試看不到**。
 *
 * ⚠️ 所以這一支走**真的 Blockly**（無頭工作區）：渲染出的狀態載進去、再存出來、再抽回語義。
 * 只比渲染出的 JSON 會漏掉它——那份 JSON 裡本來就沒有名字，是 Blockly 在 init 時補上的 `i`。
 */

import { describe, it, expect, beforeAll } from 'vitest'
import * as Blockly from 'blockly'
import { registerFieldMultilineInput } from '@blockly/field-multilineinput'
import { BlockSpecRegistry } from '../../src/core/blocks/block-spec-registry'
import { PatternRenderer } from '../../src/core/projection/pattern-renderer'
import { PatternExtractor } from '../../src/core/projection/pattern-extractor'
import { RenderStrategyRegistry } from '../../src/core/registry'
import { registerCppRenderStrategies } from '../../src/languages/cpp/renderers/strategies'
import { allCppProjections } from '../../src/languages/cpp/all-declarations'
import { allComponentDefs } from '../helpers/component-scan'
import { generatePython, liftPython } from '../helpers/python-lift'
// ⚠️ 副作用匯入：宣告降級積木（`raw_code` 要靠它才渲得出來）
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { renderToBlocklyState, setPatternRenderer } from '../../src/core/projection/block-renderer'
import { registerDynamicDropdownField, declareDropdownSource } from '../../src/panels/blocks/dynamic-dropdown-field'
import { componentLabels } from '../../src/core/component/labels'
import i18nBlocks from '../../src/i18n/zh-TW/blocks.json'

let renderer: PatternRenderer
let extractor: PatternExtractor
let ws: Blockly.Workspace

beforeAll(async () => {
  registerCppLanguage()
  const reg = new BlockSpecRegistry()
  reg.loadFromSplit(allComponentDefs(), allCppProjections())
  const specs = reg.getAll()
  const rsr = new RenderStrategyRegistry()
  registerCppRenderStrategies(rsr)
  renderer = new PatternRenderer()
  renderer.setRenderStrategyRegistry(rsr)
  renderer.loadBlockSpecs(specs)
  extractor = new PatternExtractor()
  extractor.loadBlockSpecs(specs)
  // 積木那一路：與 form-invariance 同一套（產品宣告哪些，這裡就宣告哪些）
  registerFieldMultilineInput()
  registerDynamicDropdownField()
  for (const k of ['names', 'vars', 'funcs', 'arrays', 'cpp_var_types', 'cpp_param_types', 'cpp_return_types', 'python_types']) declareDropdownSource(k, () => [])
  ws = new Blockly.Workspace()
  Object.assign(Blockly.Msg as Record<string, string>, i18nBlocks, componentLabels('zh-TW'))
  const { BlockRegistrar } = await import('../../src/panels/blocks/block-registrar')
  new BlockRegistrar(reg).registerAll({ getWorkspace: () => ws })
}, 120_000)

const throughBlocks = async (code: string): Promise<string> => {
  const sem = await liftPython(code)
  setPatternRenderer(renderer)
  const st = renderToBlocklyState(sem!)
  ws.clear()
  const blk = Blockly.serialization.blocks.append(st.blocks.blocks[0], ws)
  return generatePython(extractor.extract(Blockly.serialization.blocks.save(blk) as never)).trim()
}

describe('綁定的名字走一趟真的積木回來', () => {
  for (const c of [
    'for c in xs:\n    print(c)',
    'for k, v in d.items():\n    print(k, v)',
    'y = [x * 2 for x in xs]',
    't = [(a, b) for a, b in zip(xs, ys) if b - a == 2]',
    's = [w for w, c in r if c == 1]',
    'z = "".join(ch * n for ch, n in runs)',
    'd = {k: v for k, v in xs}',
    'q = [x for row in g for x in row]',
    'a = b = 0',
    'is_prime[0] = is_prime[1] = False',
    'o.x = y = 1',
  ]) {
    it(c.split('\n')[0], async () => {
      expect(await throughBlocks(c + '\n')).toBe(c)
    })
  }
})
