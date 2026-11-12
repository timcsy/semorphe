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

describe('已知的正規化：同一支程式，文字不同', () => {
  // 第 420 刀：`for (a, b) in …` 的括號是排版註記，積木那一趟不存它——回來是 `for a, b in …`（Python 的同一支程式）
  it('for (a, b) in ps → for a, b in ps', async () => {
    expect(await throughBlocks('for (a, b) in ps:\n    print(a + b)\n')).toBe('for a, b in ps:\n    print(a + b)')
  })
})

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
    // 第 412 刀：f-string 的轉換是插值那一格的下拉——走一趟積木要回得來（空字串那個選項＝沒有轉換）
    'p = f"{s!r:<16}-> {t!s}|{u!a}|{v}|{w:.2f}"',
    // 第 418 刀：自我說明 `{x=}` 是插值那一格的另一個下拉（空字串那個選項＝沒有）
    'p = f"{x=}|{s = }|{v=:.2f}|{s=!s}|{o.n=}"',
    // 第 417 刀：迴圈的 `else:` 走齒輪——`for` 的參數列 ＋ 尾巴兩個機制存在同一份 extraState 裡
    'for i in xs:\n    if i > 2:\n        break\nelse:\n    print("none")',
    'for k, v in d.items():\n    print(k)\nelse:\n    print(v)',
    'while n > 0:\n    n = n - 1\nelse:\n    print(n)',
    // 第 416 刀：主體只有 pass 的空類別——積木上方法與欄位兩格都是空的，回來要寫回 pass
    'class P:\n    pass',
    // 第 420 刀：目標是一個樣式——接在 PATTERN 那一格的元組／變數／展開積木
    'for i, (w, c) in enumerate(r, 1):\n    print(i, w, c)',
    'for x, in ps:\n    print(x)',
    'for a, *rest in rows:\n    print(a, rest)',
    'for (dr, dc), name in moves.items():\n    print(name)\nelse:\n    print(0)',
    // 第 421 刀：序列指派的目標是一個樣式——左值（名字、索引、屬性）組成的元組與展開，接在 PATTERN 那一格
    'a[i], a[j] = a[j], a[i]',
    'first, *mid, last = r',
    'a, (b, c) = 1, (2, 3)',
    'o.x, o.y = o.y, o.x',
    'x, = t',
    // 第 422 刀：推導式的目標是一個樣式——同一個 PATTERN 插槽，串列／產生器／集合／字典四種推導式
    'r = [n for n, *_ in g]',
    'r = [x for i, (x, y) in enumerate(ps) if i > 0]',
    'r = sum(a * b for (a, b), c in zip(u, v))',
    'r = {x for x, in ps}',
    'r = {k: a for k, (a, b) in d.items()}',
    // 第 419 刀：產生器運算式只在它是呼叫唯一的引數時不帶自己的括號——判準是語義樹的結構，走過積木還在
    'print(sum(x for x in r), any(x > 1 for x in r))',
    'g = (x for x in r)',
    'print(*(f"{x:3}" for x in r))',
    'm = max((x for x in r), default=0)',
    't = sorted((x for x in r), reverse=True)',
    'f(a, (x for x in r))',
  ]) {
    it(c.split('\n')[0], async () => {
      expect(await throughBlocks(c + '\n')).toBe(c)
    })
  }
})
