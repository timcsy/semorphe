import { describe, it, expect } from 'vitest'
import type { BlockSpec, CodeTemplate, AstPattern, ValidationError, WorkspaceState, SourceMapping, BlockJSON, WorkspaceJSON } from '../../src/core/types'

describe('BlockSpec 型別驗證', () => {
  it('should accept a valid BlockSpec object', () => {
    const spec: BlockSpec = {
      id: 'c_for_loop',
      language: 'cpp',
      category: 'loops',
      version: '1.0.0',
      blockDef: {
        type: 'c_for_loop',
        message0: 'for %1 ; %2 ; %3',
        colour: 120,
      },
      codeTemplate: {
        pattern: 'for (${INIT}; ${COND}; ${UPDATE}) {\n${BODY}\n}',
        imports: [],
        order: 0,
      },
      astPattern: {
        nodeType: 'for_statement',
        constraints: [],
      },
    }

    expect(spec.id).toBe('c_for_loop')
    expect(spec.category).toBe('loops')
    expect(spec.codeTemplate?.pattern).toContain('${INIT}')
    expect(spec.astPattern?.nodeType).toBe('for_statement')
  })

  it('should accept CodeTemplate with imports', () => {
    const template: CodeTemplate = {
      pattern: 'printf(${FORMAT}, ${ARGS})',
      imports: ['stdio.h'],
      order: 0,
    }

    expect(template.imports).toContain('stdio.h')
    expect(template.imports).toHaveLength(1)
  })

  it('should accept AstPattern with constraints', () => {
    const pattern: AstPattern = {
      nodeType: 'binary_expression',
      constraints: [
        { field: 'operator', text: '+' },
      ],
    }

    expect(pattern.constraints).toHaveLength(1)
    expect(pattern.constraints[0].text).toBe('+')
  })

  it('should accept ValidationError structure', () => {
    const error: ValidationError = {
      field: 'blockDef.type',
      message: 'blockDef.type must match id',
    }

    expect(error.field).toBe('blockDef.type')
    expect(error.message).toContain('must match')
  })

  it('should accept WorkspaceState structure', () => {
    const state: WorkspaceState = {
      blocklyState: {},
      code: '#include <stdio.h>\nint main() {}',
      languageId: 'cpp',
      customBlockSpecs: [],
      lastModified: '2026-03-02T00:00:00Z',
    }

    expect(state.languageId).toBe('cpp')
    expect(state.customBlockSpecs).toHaveLength(0)
  })

  it('should accept universal BlockSpec without codeTemplate/astPattern', () => {
    const spec: BlockSpec = {
      id: 'u_var_declare',
      language: 'universal',
      category: 'data',
      version: '1.0.0',
      blockDef: {
        type: 'u_var_declare',
        message0: '建立 %1 變數 %2 = %3',
        colour: 330,
      },
    }

    expect(spec.language).toBe('universal')
    expect(spec.codeTemplate).toBeUndefined()
    expect(spec.astPattern).toBeUndefined()
  })

  it('should require language field on BlockSpec', () => {
    const spec: BlockSpec = {
      id: 'c_for_loop',
      language: 'cpp',
      category: 'loops',
      version: '1.0.0',
      blockDef: { type: 'c_for_loop' },
      codeTemplate: { pattern: 'for(...)', imports: [], order: 0 },
      astPattern: { nodeType: 'for_statement', constraints: [] },
    }

    expect(spec.language).toBe('cpp')
  })

  it('should accept SourceMapping structure', () => {
    const mapping: SourceMapping = {
      blockId: 'block_1',
      startLine: 0,
      endLine: 2,
    }

    expect(mapping.blockId).toBe('block_1')
    expect(mapping.startLine).toBe(0)
    expect(mapping.endLine).toBe(2)
  })

  it('should accept BlockJSON structure', () => {
    const block: BlockJSON = {
      type: 'u_var_declare',
      id: 'block_1',
      fields: { TYPE: 'int', NAME: 'x' },
      inputs: {
        INIT: { block: { type: 'u_number', id: 'block_2', fields: { NUM: 0 } } },
      },
    }

    expect(block.type).toBe('u_var_declare')
    expect(block.inputs?.INIT.block.type).toBe('u_number')
  })

  it('should accept WorkspaceJSON structure', () => {
    const ws: WorkspaceJSON = {
      blocks: {
        languageVersion: 0,
        blocks: [
          { type: 'u_print', id: 'b1', inputs: { EXPR0: { block: { type: 'u_string', id: 'b2', fields: { TEXT: 'Hello' } } }, EXPR1: { block: { type: 'u_endl', id: 'b3' } } } },
        ],
      },
    }

    expect(ws.blocks.blocks).toHaveLength(1)
    expect(ws.blocks.blocks[0].type).toBe('u_print')
  })
})
