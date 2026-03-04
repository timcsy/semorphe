import { describe, it, expect, beforeEach } from 'vitest'
import { BlockRegistry } from '../../src/core/block-registry'
import type { BlockSpec } from '../../src/core/types'
import { DEFAULT_TEMPLATE_STATE, BEGINNER_BLOCKS, QUICK_ACCESS_ITEMS } from '../../src/core/types'
import { runDiagnosticsOnState } from '../../src/core/diagnostics'
import universalBlocks from '../../src/blocks/universal.json'
import basicBlocks from '../../src/languages/cpp/blocks/basic.json'
import advancedBlocks from '../../src/languages/cpp/blocks/advanced.json'
import specialBlocks from '../../src/languages/cpp/blocks/special.json'

describe('US1: 預設程式骨架', () => {
  it('DEFAULT_TEMPLATE_STATE 包含 c_include, c_using_namespace, u_func_def, u_return 積木', () => {
    const blocks = DEFAULT_TEMPLATE_STATE.blocks.blocks
    expect(blocks).toHaveLength(1)

    const root = blocks[0]
    expect(root.type).toBe('c_include')
    expect(root.fields?.HEADER).toBe('iostream')

    const using = root.next?.block
    expect(using).toBeDefined()
    expect(using!.type).toBe('c_using_namespace')
    expect(using!.fields?.NAMESPACE).toBe('std')

    const funcDef = using!.next?.block
    expect(funcDef).toBeDefined()
    expect(funcDef!.type).toBe('u_func_def')
    expect(funcDef!.fields?.NAME).toBe('main')
    expect(funcDef!.fields?.RETURN_TYPE).toBe('int')

    const returnBlock = funcDef!.inputs?.BODY?.block
    expect(returnBlock).toBeDefined()
    expect(returnBlock!.type).toBe('u_return')

    const zeroBlock = returnBlock!.inputs?.VALUE?.block
    expect(zeroBlock).toBeDefined()
    expect(zeroBlock!.type).toBe('u_number')
    expect(zeroBlock!.fields?.NUM).toBe('0')
  })

  it('DEFAULT_TEMPLATE_STATE 的 languageVersion 為 0', () => {
    expect(DEFAULT_TEMPLATE_STATE.blocks.languageVersion).toBe(0)
  })
})

describe('US2: 工具箱分級顯示', () => {
  let registry: BlockRegistry

  beforeEach(() => {
    registry = new BlockRegistry()
    const allBlocks = [...universalBlocks, ...basicBlocks, ...advancedBlocks, ...specialBlocks] as BlockSpec[]
    allBlocks.forEach(spec => registry.register(spec))
  })

  it('初級模式積木數 ≤ 18 且分類 ≤ 6', () => {
    const toolbox = registry.toToolboxDef('cpp', 'beginner')
    const totalBlocks = toolbox.contents.reduce((sum, cat) => sum + cat.contents.length, 0)
    expect(totalBlocks).toBeLessThanOrEqual(18)
    expect(toolbox.contents.length).toBeLessThanOrEqual(6)
  })

  it('進階模式顯示全部 67 個積木', () => {
    const toolbox = registry.toToolboxDef('cpp', 'advanced')
    const totalBlocks = toolbox.contents.reduce((sum, cat) => sum + cat.contents.length, 0)
    expect(totalBlocks).toBe(67)
  })

  it('初級模式隱藏 c_printf/c_scanf 但顯示 u_print/u_input', () => {
    const toolbox = registry.toToolboxDef('cpp', 'beginner')
    const allTypes = toolbox.contents.flatMap(cat => cat.contents.map(b => b.type))
    expect(allTypes).toContain('u_print')
    expect(allTypes).toContain('u_input')
    expect(allTypes).not.toContain('c_printf')
    expect(allTypes).not.toContain('c_scanf')
  })

  it('BEGINNER_BLOCKS 包含正確的 18 個積木', () => {
    expect(BEGINNER_BLOCKS).toHaveLength(18)
    expect(BEGINNER_BLOCKS).toContain('u_var_declare')
    expect(BEGINNER_BLOCKS).toContain('u_if')
    expect(BEGINNER_BLOCKS).toContain('u_print')
    expect(BEGINNER_BLOCKS).toContain('u_func_def')
    expect(BEGINNER_BLOCKS).toContain('u_endl')
  })
})

describe('US4: 連接型別檢查', () => {
  it('所有 universal.json 的 statement 積木 previousStatement 為 "Statement"', () => {
    for (const spec of universalBlocks as BlockSpec[]) {
      const bd = spec.blockDef as Record<string, unknown>
      if ('previousStatement' in bd) {
        expect(bd.previousStatement, `${spec.id} previousStatement`).toBe('Statement')
      }
      if ('nextStatement' in bd) {
        expect(bd.nextStatement, `${spec.id} nextStatement`).toBe('Statement')
      }
    }
  })

  it('所有 basic.json 的 statement 積木 previousStatement 為 "Statement"', () => {
    for (const spec of basicBlocks as BlockSpec[]) {
      const bd = spec.blockDef as Record<string, unknown>
      if ('previousStatement' in bd) {
        expect(bd.previousStatement, `${spec.id} previousStatement`).toBe('Statement')
      }
      if ('nextStatement' in bd) {
        expect(bd.nextStatement, `${spec.id} nextStatement`).toBe('Statement')
      }
    }
  })

  it('所有 advanced.json 的 statement 積木 previousStatement 為 "Statement"', () => {
    for (const spec of advancedBlocks as BlockSpec[]) {
      const bd = spec.blockDef as Record<string, unknown>
      if ('previousStatement' in bd) {
        expect(bd.previousStatement, `${spec.id} previousStatement`).toBe('Statement')
      }
      if ('nextStatement' in bd) {
        expect(bd.nextStatement, `${spec.id} nextStatement`).toBe('Statement')
      }
    }
  })

  it('所有 special.json 的 statement 積木 previousStatement 為 "Statement"', () => {
    for (const spec of specialBlocks as BlockSpec[]) {
      const bd = spec.blockDef as Record<string, unknown>
      if ('previousStatement' in bd) {
        expect(bd.previousStatement, `${spec.id} previousStatement`).toBe('Statement')
      }
      if ('nextStatement' in bd) {
        expect(bd.nextStatement, `${spec.id} nextStatement`).toBe('Statement')
      }
    }
  })

  it('所有 input_statement 類型有 check: "Statement"', () => {
    const allBlocks = [...universalBlocks, ...basicBlocks, ...advancedBlocks, ...specialBlocks] as BlockSpec[]
    for (const spec of allBlocks) {
      const bd = spec.blockDef as Record<string, unknown>
      for (let i = 0; ; i++) {
        const argsKey = `args${i}`
        const args = bd[argsKey] as Array<Record<string, unknown>> | undefined
        if (!args) break
        for (const arg of args) {
          if (arg.type === 'input_statement') {
            expect(arg.check, `${spec.id} ${arg.name} input_statement check`).toBe('Statement')
          }
        }
      }
    }
  })
})

describe('US5: 快捷列常數', () => {
  it('QUICK_ACCESS_ITEMS 包含 6 個項目', () => {
    expect(QUICK_ACCESS_ITEMS).toHaveLength(6)
  })

  it('每個項目有 blockType, labelKey, fallbackLabel, icon 欄位', () => {
    for (const item of QUICK_ACCESS_ITEMS) {
      expect(item.blockType).toBeTruthy()
      expect(item.labelKey).toBeTruthy()
      expect(item.fallbackLabel).toBeTruthy()
      expect(item.icon).toBeTruthy()
    }
  })

  it('快捷列包含 u_var_declare, u_print, u_input, u_if, u_count_loop, u_func_def', () => {
    const types = QUICK_ACCESS_ITEMS.map(i => i.blockType)
    expect(types).toContain('u_var_declare')
    expect(types).toContain('u_print')
    expect(types).toContain('u_input')
    expect(types).toContain('u_if')
    expect(types).toContain('u_count_loop')
    expect(types).toContain('u_func_def')
  })
})

describe('US6: 即時錯誤提示', () => {
  it('非 void 函式無 return 回傳 missing_return 診斷', () => {
    const state = {
      blocks: {
        languageVersion: 0,
        blocks: [{
          type: 'u_func_def', id: 'func1',
          fields: { NAME: 'main', RETURN_TYPE: 'int' },
          inputs: { BODY: { block: { type: 'u_print', id: 'p1' } } },
        }],
      },
    }
    const diags = runDiagnosticsOnState(state)
    expect(diags).toHaveLength(1)
    expect(diags[0].type).toBe('missing_return')
    expect(diags[0].blockId).toBe('func1')
  })

  it('非 void 函式有 return 不回傳警告', () => {
    const state = {
      blocks: {
        languageVersion: 0,
        blocks: [{
          type: 'u_func_def', id: 'func1',
          fields: { NAME: 'main', RETURN_TYPE: 'int' },
          inputs: { BODY: { block: { type: 'u_return', id: 'r1', inputs: { VALUE: { block: { type: 'u_number', id: 'n1', fields: { NUM: '0' } } } } } } },
        }],
      },
    }
    const diags = runDiagnosticsOnState(state)
    expect(diags).toHaveLength(0)
  })

  it('void 函式無 return 不回傳警告', () => {
    const state = {
      blocks: {
        languageVersion: 0,
        blocks: [{
          type: 'u_func_def', id: 'func1',
          fields: { NAME: 'printHello', RETURN_TYPE: 'void' },
          inputs: { BODY: { block: { type: 'u_print', id: 'p1' } } },
        }],
      },
    }
    const diags = runDiagnosticsOnState(state)
    expect(diags).toHaveLength(0)
  })

  it('未宣告的 u_var_ref 回傳 undeclared_variable 診斷', () => {
    const state = {
      blocks: {
        languageVersion: 0,
        blocks: [{
          type: 'u_var_ref', id: 'ref1',
          fields: { NAME: 'y' },
        }],
      },
    }
    const diags = runDiagnosticsOnState(state)
    expect(diags).toHaveLength(1)
    expect(diags[0].type).toBe('undeclared_variable')
    expect(diags[0].blockId).toBe('ref1')
  })

  it('已宣告的 u_var_ref 不回傳警告', () => {
    const state = {
      blocks: {
        languageVersion: 0,
        blocks: [
          { type: 'u_var_declare', id: 'decl1', fields: { NAME: 'y', TYPE: 'int' } },
          { type: 'u_var_ref', id: 'ref1', fields: { NAME: 'y' } },
        ],
      },
    }
    const diags = runDiagnosticsOnState(state)
    expect(diags).toHaveLength(0)
  })

  it('u_count_loop 的 VAR 視為已宣告', () => {
    const state = {
      blocks: {
        languageVersion: 0,
        blocks: [{
          type: 'u_count_loop', id: 'loop1',
          fields: { VAR: 'i' },
          inputs: {
            BODY: {
              block: { type: 'u_var_ref', id: 'ref1', fields: { NAME: 'i' } },
            },
          },
        }],
      },
    }
    const diags = runDiagnosticsOnState(state)
    expect(diags).toHaveLength(0)
  })
})
