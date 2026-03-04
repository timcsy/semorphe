import { describe, it, expect, beforeEach } from 'vitest'
import { CppGenerator } from '../../src/languages/cpp/generator'
import { BlockRegistry } from '../../src/core/block-registry'
import type { BlockSpec } from '../../src/core/types'

function makeSpec(id: string, category: string, nodeType: string, pattern: string, imports: string[] = [], order = 0): BlockSpec {
  return {
    id, language: 'cpp', category, version: '1.0.0',
    blockDef: { type: id },
    codeTemplate: { pattern, imports, order },
    astPattern: { nodeType, constraints: [] },
  }
}

describe('CppGenerator', () => {
  let registry: BlockRegistry
  let generator: CppGenerator

  beforeEach(() => {
    registry = new BlockRegistry()
    registry.register(makeSpec('c_printf', 'io', 'call_expression', 'printf("${FORMAT}"${ARGS});', ['stdio.h']))
    registry.register(makeSpec('c_scanf', 'io', 'call_expression', 'scanf("${FORMAT}"${ARGS});', ['stdio.h']))
    registry.register(makeSpec('c_var_declare_init', 'variables', 'declaration', '${TYPE} ${NAME} = ${INIT};'))
    registry.register(makeSpec('c_number', 'values', 'number_literal', '${NUM}', [], 20))
    registry.register(makeSpec('c_variable_ref', 'variables', 'identifier', '${NAME}', [], 20))
    registry.register(makeSpec('c_binary_op', 'operators', 'binary_expression', '${A} ${OP} ${B}', [], 6))
    registry.register(makeSpec('c_compare_op', 'operators', 'binary_expression', '${A} ${OP} ${B}', [], 3))
    registry.register(makeSpec('c_logical_op', 'operators', 'binary_expression', '${A} ${OP} ${B}', [], 1))
    registry.register(makeSpec('c_if', 'conditions', 'if_statement', 'if (${COND}) {\n${BODY}\n}'))
    registry.register(makeSpec('c_for_loop', 'loops', 'for_statement', 'for (${INIT}; ${COND}; ${UPDATE}) {\n${BODY}\n}'))
    registry.register(makeSpec('c_return', 'functions', 'return_statement', 'return ${VALUE};'))
    registry.register(makeSpec('c_function_def', 'functions', 'function_definition', '${RETURN_TYPE} ${NAME}(${PARAMS}) {\n${BODY}\n}'))
    registry.register(makeSpec('c_break', 'loops', 'break_statement', 'break;'))
    registry.register(makeSpec('c_include', 'preprocessor', 'preproc_include', '#include <${HEADER}>'))
    registry.register(makeSpec('c_raw_code', 'special', '_raw_code', '${CODE}'))

    generator = new CppGenerator(registry)
  })

  describe('單一積木產生程式碼', () => {
    it('should generate code for a simple printf block', () => {
      const workspace = {
        blocks: {
          languageVersion: 0,
          blocks: [{
            type: 'c_printf',
            id: 'b1',
            fields: { FORMAT: 'Hello\\n', ARGS: '' },
          }],
        },
      }
      const code = generator.generate(workspace)
      expect(code).toContain('printf("Hello\\n")')
    })

    it('should generate code for variable declaration with init', () => {
      const workspace = {
        blocks: {
          languageVersion: 0,
          blocks: [{
            type: 'c_var_declare_init',
            id: 'b1',
            fields: { TYPE: 'int', NAME: 'x' },
            inputs: {
              INIT: { block: { type: 'c_number', id: 'b2', fields: { NUM: 10 } } },
            },
          }],
        },
      }
      const code = generator.generate(workspace)
      expect(code).toContain('int x = 10;')
    })

    it('should generate code for break statement', () => {
      const workspace = {
        blocks: {
          languageVersion: 0,
          blocks: [{ type: 'c_break', id: 'b1' }],
        },
      }
      const code = generator.generate(workspace)
      expect(code).toContain('break;')
    })

    it('should generate raw code block', () => {
      const workspace = {
        blocks: {
          languageVersion: 0,
          blocks: [{ type: 'c_raw_code', id: 'b1', fields: { CODE: 'int a = 42;' } }],
        },
      }
      const code = generator.generate(workspace)
      expect(code).toContain('int a = 42;')
    })
  })

  describe('巢狀積木', () => {
    it('should generate nested if with condition', () => {
      const workspace = {
        blocks: {
          languageVersion: 0,
          blocks: [{
            type: 'c_if',
            id: 'b1',
            inputs: {
              COND: {
                block: {
                  type: 'c_compare_op',
                  id: 'b2',
                  fields: { OP: '>' },
                  inputs: {
                    A: { block: { type: 'c_variable_ref', id: 'b3', fields: { NAME: 'x' } } },
                    B: { block: { type: 'c_number', id: 'b4', fields: { NUM: 0 } } },
                  },
                },
              },
              BODY: {
                block: {
                  type: 'c_printf',
                  id: 'b5',
                  fields: { FORMAT: 'positive\\n', ARGS: '' },
                },
              },
            },
          }],
        },
      }
      const code = generator.generate(workspace)
      expect(code).toContain('if (x > 0)')
      expect(code).toContain('printf("positive\\n")')
    })

    it('should handle statement chains via next', () => {
      const workspace = {
        blocks: {
          languageVersion: 0,
          blocks: [{
            type: 'c_printf',
            id: 'b1',
            fields: { FORMAT: 'first\\n', ARGS: '' },
            next: {
              block: {
                type: 'c_printf',
                id: 'b2',
                fields: { FORMAT: 'second\\n', ARGS: '' },
              },
            },
          }],
        },
      }
      const code = generator.generate(workspace)
      const lines = code.split('\n').filter((l: string) => l.includes('printf'))
      expect(lines).toHaveLength(2)
      expect(lines[0]).toContain('first')
      expect(lines[1]).toContain('second')
    })

    it('should generate for loop with body', () => {
      const workspace = {
        blocks: {
          languageVersion: 0,
          blocks: [{
            type: 'c_for_loop',
            id: 'b1',
            inputs: {
              INIT: { block: { type: 'c_raw_code', id: 'b2', fields: { CODE: 'int i = 0' } } },
              COND: { block: { type: 'c_compare_op', id: 'b3', fields: { OP: '<' }, inputs: {
                A: { block: { type: 'c_variable_ref', id: 'b4', fields: { NAME: 'i' } } },
                B: { block: { type: 'c_number', id: 'b5', fields: { NUM: 10 } } },
              } } },
              UPDATE: { block: { type: 'c_raw_code', id: 'b6', fields: { CODE: 'i++' } } },
              BODY: { block: { type: 'c_printf', id: 'b7', fields: { FORMAT: '%d\\n', ARGS: ', i' } } },
            },
          }],
        },
      }
      const code = generator.generate(workspace)
      expect(code).toContain('for (int i = 0; i < 10; i++)')
      expect(code).toContain('printf("%d\\n", i)')
    })
  })

  describe('#include 收集', () => {
    it('should collect imports from printf block', () => {
      const workspace = {
        blocks: {
          languageVersion: 0,
          blocks: [{
            type: 'c_printf',
            id: 'b1',
            fields: { FORMAT: 'hi\\n', ARGS: '' },
          }],
        },
      }
      const code = generator.generate(workspace)
      expect(code).toContain('#include <stdio.h>')
    })

    it('should deduplicate imports', () => {
      const workspace = {
        blocks: {
          languageVersion: 0,
          blocks: [{
            type: 'c_printf',
            id: 'b1',
            fields: { FORMAT: 'a\\n', ARGS: '' },
            next: {
              block: {
                type: 'c_scanf',
                id: 'b2',
                fields: { FORMAT: '%d', ARGS: ', &x' },
              },
            },
          }],
        },
      }
      const code = generator.generate(workspace)
      const includes = code.split('\n').filter((l: string) => l.startsWith('#include'))
      expect(includes).toHaveLength(1)
      expect(includes[0]).toBe('#include <stdio.h>')
    })

    it('should place includes at the top of generated code', () => {
      const workspace = {
        blocks: {
          languageVersion: 0,
          blocks: [{
            type: 'c_printf',
            id: 'b1',
            fields: { FORMAT: 'test\\n', ARGS: '' },
          }],
        },
      }
      const code = generator.generate(workspace)
      const lines = code.split('\n').filter((l: string) => l.trim())
      expect(lines[0]).toMatch(/^#include/)
    })

    it('should not add includes for blocks without imports', () => {
      const workspace = {
        blocks: {
          languageVersion: 0,
          blocks: [{ type: 'c_break', id: 'b1' }],
        },
      }
      const code = generator.generate(workspace)
      expect(code).not.toContain('#include')
    })
  })

  describe('運算子優先順序括號', () => {
    it('should add parentheses when lower precedence nested in higher', () => {
      // (a + b) * c  → the + has lower precedence (order=6) than * (order=7)
      // But wait, in our system higher order = higher precedence (tighter binding)
      // Actually let me reconsider: order 6 = additive, order 7 = multiplicative
      // When a lower-order (lower precedence) expression is a child of higher-order: need parens
      // a + b where + is order 6
      // (a + b) * c where * is order 7 and child (a+b) is order 6 < 7 → needs parens
      const workspace = {
        blocks: {
          languageVersion: 0,
          blocks: [{
            type: 'c_binary_op', // order 6
            id: 'mul',
            fields: { OP: '*' },
            inputs: {
              A: {
                block: {
                  type: 'c_binary_op', // order 6
                  id: 'add',
                  fields: { OP: '+' },
                  inputs: {
                    A: { block: { type: 'c_variable_ref', id: 'a', fields: { NAME: 'a' } } },
                    B: { block: { type: 'c_variable_ref', id: 'b', fields: { NAME: 'b' } } },
                  },
                },
              },
              B: { block: { type: 'c_variable_ref', id: 'c', fields: { NAME: 'c' } } },
            },
          }],
        },
      }
      const code = generator.generate(workspace)
      // Both are order 6, so the child (a+b) is nested inside parent (*) at same order level
      // For same-level, parentheses should be added for safety when ops differ
      expect(code).toContain('(a + b) * c')
    })

    it('should not add unnecessary parentheses for high-precedence atoms', () => {
      // x > 0 → variable_ref (order 20) inside compare (order 3) → no parens needed
      const workspace = {
        blocks: {
          languageVersion: 0,
          blocks: [{
            type: 'c_compare_op',
            id: 'cmp',
            fields: { OP: '>' },
            inputs: {
              A: { block: { type: 'c_variable_ref', id: 'x', fields: { NAME: 'x' } } },
              B: { block: { type: 'c_number', id: 'n', fields: { NUM: 0 } } },
            },
          }],
        },
      }
      const code = generator.generate(workspace)
      expect(code).toContain('x > 0')
      expect(code).not.toContain('(x)')
      expect(code).not.toContain('(0)')
    })
  })

  describe('空 workspace', () => {
    it('should return empty string for empty workspace', () => {
      const workspace = { blocks: { languageVersion: 0, blocks: [] } }
      const code = generator.generate(workspace)
      expect(code.trim()).toBe('')
    })
  })

  describe('未知積木類型', () => {
    it('should handle unknown block types gracefully', () => {
      const workspace = {
        blocks: {
          languageVersion: 0,
          blocks: [{ type: 'unknown_block', id: 'b1', fields: {} }],
        },
      }
      expect(() => generator.generate(workspace)).not.toThrow()
      const code = generator.generate(workspace)
      expect(code).toContain('/* unknown block: unknown_block */')
    })
  })
})
