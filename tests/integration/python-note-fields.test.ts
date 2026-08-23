/**
 * **標頭註解在積木上有一格自己的欄位**（2026-08-23，使用者：「走 ②」）。
 *
 * ## 這一支釘的是什麼
 *
 * 前一版把 `if a:  # 為什麼` 的註解放進 `extraState`——轉得回去，
 * **而積木上看不到、點不到、改不掉**。使用者問「能不能有其他的處理方式」，
 * 選了 ②：**每個標頭一格真的欄位**，收在齒輪的「顯示註解」後面。
 *
 * > **使用者打的字要有一個看得到的家。**
 *
 * ## 🔴 為什麼要走【真的工作區】，不能只走 BlockState
 *
 * 註解欄位是 **mutator 長出來的**——`ELIF_NOTE_1` 這一格在 `loadExtraState`
 * 跑完之前**不存在**。而 Blockly 載入的順序是 `extraState` 先、欄位後：
 * 少一步（渲染那一路忘了掀 `showNotes`）的症狀是
 * **Blockly 安靜地丟掉那個欄位值**——一份 JSON 對照的測試看不到這件事。
 *
 * ⚠️ 第五十一條護欄的教訓在這裡再一次成立：
 * 「渲得出積木」如果渲的是 JSON，它對「Blockly 收不收得下」一個字都沒說。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import * as Blockly from 'blockly'
import { registerFieldMultilineInput } from '@blockly/field-multilineinput'
import { registerDynamicDropdownField, declareDropdownSource } from '../../src/ui/dynamic-dropdown-field'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { allCppProjections } from '../../src/languages/cpp/all-declarations'
import { allComponentDefs } from '../helpers/component-scan'
import { componentLabels } from '../../src/core/component/labels'
import i18nBlocks from '../../src/i18n/zh-TW/blocks.json'
import { liftPython, generatePython, createPythonLifter } from '../helpers/python-lift'
import { setDegradationLanguage } from '../../src/core/degradation-blocks'
import { PatternRenderer } from '../../src/core/projection/pattern-renderer'
import { PatternExtractor } from '../../src/core/projection/pattern-extractor'
import type { BlockState } from '../../src/core/projection/pattern-extractor'
import { renderToBlocklyState, setPatternRenderer } from '../../src/core/projection/block-renderer'
import { PythonParser } from '../../src/languages/python/parser'
import { Parser } from 'web-tree-sitter'

let reg: BlockSpecRegistry
let extractor: PatternExtractor

beforeAll(async () => {
  registerFieldMultilineInput()
  registerDynamicDropdownField()
  for (const k of ['names', 'vars', 'funcs', 'arrays', 'python_types']) declareDropdownSource(k, () => [])
  reg = new BlockSpecRegistry()
  reg.loadFromSplit(allComponentDefs(), allCppProjections())
  Object.assign(Blockly.Msg as Record<string, string>, i18nBlocks, componentLabels('zh-TW'))

  const { BlockRegistrar, setLanguageInputNames } = await import('../../src/ui/block-registrar')
  const n = await import('../../src/languages/cpp/block-input-names')
  setLanguageInputNames({
    compoundAssign: n.C_COMPOUND_ASSIGN_INPUTS, compoundAssignExpr: n.C_COMPOUND_ASSIGN_EXPR_INPUTS,
    varDeclareExpr: n.C_VAR_DECLARE_EXPR_INPUTS, ifBlock: n.IF_INPUTS, whileBlock: n.WHILE_INPUTS,
    countLoop: n.COUNT_LOOP_INPUTS, funcDef: n.FUNDEF_INPUTS, returnBlock: n.RETURN_INPUTS,
    arrayAccess: n.ARRAY_ACCESS_INPUTS, arrayAssign: n.ARRAY_ASSIGN_INPUTS, varAssign: n.VAR_ASSIGN_INPUTS,
  })
  const ws0 = new Blockly.Workspace()
  new BlockRegistrar(reg).registerAll({ getWorkspace: () => ws0 })

  const renderer = new PatternRenderer()
  renderer.loadBlockSpecs(reg.getAll())
  setPatternRenderer(renderer)
  extractor = new PatternExtractor()
  extractor.loadBlockSpecs(reg.getAll())

  const pyParser = new PythonParser()
  await pyParser.init(`${process.cwd()}/public`)
  await Parser.init()
  createPythonLifter()
  setDegradationLanguage('python')
})

/** 產品那一支的最小翻版（`blockly-panel.serializeBlockToState`）。 */
function toState(block: Blockly.Block): BlockState {
  const fields: Record<string, unknown> = {}
  const inputs: Record<string, { block: BlockState }> = {}
  for (const input of block.inputList) {
    for (const f of input.fieldRow) if (f.name) fields[f.name] = f.getValue()
    const target = input.connection?.targetBlock()
    if (target) inputs[input.name] = { block: toState(target) }
  }
  const state: BlockState = { type: block.type, id: block.id, fields, inputs }
  const save = (block as unknown as { saveExtraState?: () => unknown }).saveExtraState
  if (typeof save === 'function') {
    const extra = save.call(block)
    if (extra) state.extraState = extra as Record<string, unknown>
  }
  const next = block.getNextBlock()
  if (next) state.next = { block: toState(next) }
  return state
}

/** 程式碼 → 語義樹 → 積木 →（**真的工作區**）→ 語義樹 → 程式碼。 */
async function throughWorkspace(code: string): Promise<{ out: string; top: Blockly.Block }> {
  const tree = await liftPython(code)
  const { blockMappings: _drop, ...state } = renderToBlocklyState(tree!)
  const ws = new Blockly.Workspace()
  Blockly.serialization.workspaces.load(state, ws)
  const top = ws.getTopBlocks(false)[0]
  const nodes = ws.getTopBlocks(true)
    .map((b) => extractor.extract(toState(b)))
    .filter((n): n is NonNullable<typeof n> => n !== null)
  const root = { ...tree!, children: { ...tree!.children, body: nodes } }
  return { out: generatePython(root), top }
}

describe('標頭註解的欄位（走真的 Blockly 工作區）', () => {
  it('★ 錨點：沒有註解的 `if` 走完一趟一字不差，而且【沒有】長出註解欄位', async () => {
    const { out, top } = await throughWorkspace('if x > 0:\n    print(x)\n')
    expect(out.trim()).toBe('if x > 0:\n    print(x)')
    expect(top.getField('IF_NOTE'), '沒有註解就不該有空欄位——齒輪關著').toBeNull()
  })

  it('🔴 `if` 的標頭註解落在 `IF_NOTE` 這一格，而且看得見', async () => {
    const { out, top } = await throughWorkspace('if x > 0:  # 為什麼\n    print(x)\n')
    expect(top.getField('IF_NOTE'), '欄位沒長出來 → 使用者還是看不到他打的字').not.toBeNull()
    expect(top.getFieldValue('IF_NOTE')).toBe('為什麼')
    expect(out).toContain('# 為什麼')
  })

  it('🔴 `elif`／`else` 各有自己那一格——索引不能錯開', async () => {
    const code = 'if r > 0:  # 大於\n    x = 1\nelif r == 0:  # 等於\n    x = 2\nelse:  # 小於\n    x = 3\n'
    const { out, top } = await throughWorkspace(code)
    expect(top.getFieldValue('IF_NOTE')).toBe('大於')
    expect(top.getFieldValue('ELIF_NOTE_0')).toBe('等於')
    expect(top.getFieldValue('ELSE_NOTE')).toBe('小於')
    expect(out.trim()).toBe(code.trim())
  })

  it('🔴 齒輪關掉註解＝**收起來**，不是燒掉——再勾一次要拿得回來', async () => {
    const { top } = await throughWorkspace('if x > 0:  # 為什麼\n    print(x)\n')
    const b = top as unknown as { setNotes_: (v: boolean) => void; saveExtraState: () => Record<string, unknown> }
    b.setNotes_(false)
    expect(top.getField('IF_NOTE'), '收起來就是那一格不在了').toBeNull()
    expect(b.saveExtraState().noteText, '沒有寄放的話「還原」救不回來——實測過，Blockly 的復原事件不含被拆掉的欄位')
      .toEqual({ IF_NOTE: '為什麼' })
    b.setNotes_(true)
    expect(top.getFieldValue('IF_NOTE')).toBe('為什麼')
  })

  it('🔴 使用者把那一格清空＝那句註解沒了（`extraState` 的舊值不准長回來）', async () => {
    const { top } = await throughWorkspace('if x > 0:  # 為什麼\n    print(x)\n')
    top.setFieldValue('', 'IF_NOTE')
    const node = extractor.extract(toState(top))!
    expect(node.annotations ?? [], '刪不掉的東西比看不見的東西更糟').toEqual([])
  })

  it('🔴 函式宣告的標頭註解——它走的是另一個建構子（`paramList` 的齒輪）', async () => {
    const { out, top } = await throughWorkspace('def f(x):  # 這個函式\n    return x\n')
    expect(top.getFieldValue('HEADER_NOTE'), '兩個建構子要各自長出那一格——齒輪不同不代表規矩不同').toBe('這個函式')
    expect(top.getInput('NOTE_ROW')?.isVisible(), '欄位有值而那一排收著 → 使用者看不到').toBe(true)
    expect(out.trim()).toBe('def f(x):  # 這個函式\n    return x')
  })

  it('🔴 函式那一顆的齒輪也是【收起來】不是燒掉', async () => {
    const { top } = await throughWorkspace('def f(x):  # 這個函式\n    return x\n')
    const b = top as unknown as { setBlockOption_: (k: string, v: boolean) => void; saveExtraState: () => Record<string, unknown> }
    b.setBlockOption_('note', false)
    expect(top.getFieldValue('HEADER_NOTE'), '收起來的那一格不准把值留在裡面——留著就會偷偷寫進程式碼').toBe('')
    expect(b.saveExtraState().blockOptText).toEqual({ HEADER_NOTE: '這個函式' })
    b.setBlockOption_('note', true)
    expect(top.getFieldValue('HEADER_NOTE')).toBe('這個函式')
  })

  it('🔴 兩支 `elif` 都有註解——`{i}` 這一段要撐得住不只一支', async () => {
    const code = 'if a:  # 一\n    x = 1\nelif b:  # 二\n    x = 2\nelif c:  # 三\n    x = 3\n'
    const { out, top } = await throughWorkspace(code)
    expect(top.getFieldValue('ELIF_NOTE_0')).toBe('二')
    expect(top.getFieldValue('ELIF_NOTE_1')).toBe('三')
    expect(out.trim()).toBe(code.trim())
  })
})
