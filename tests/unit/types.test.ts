import { describe, it, expect } from 'vitest'
import type { BlockSpec, CodeTemplate, AstPattern, ValidationError, WorkspaceState } from '../../src/core/types'

describe('BlockSpec 型別驗證', () => {
  it('should accept a valid BlockSpec object', () => {
    const spec: BlockSpec = {
      id: 'c_for_loop',
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
    expect(spec.codeTemplate.pattern).toContain('${INIT}')
    expect(spec.astPattern.nodeType).toBe('for_statement')
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
})
