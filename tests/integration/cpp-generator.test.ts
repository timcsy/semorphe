import { describe, it, expect, beforeEach } from 'vitest'
import { CppGenerator } from '../../src/languages/cpp/generator'
import { CppLanguageAdapter } from '../../src/languages/cpp/adapter'
import { BlockRegistry } from '../../src/core/block-registry'
import type { BlockSpec } from '../../src/core/types'
import basicBlocks from '../../src/languages/cpp/blocks/basic.json'
import advancedBlocks from '../../src/languages/cpp/blocks/advanced.json'
import specialBlocks from '../../src/languages/cpp/blocks/special.json'
import universalBlocks from '../../src/blocks/universal.json'

describe('CppGenerator 整合測試', () => {
  let registry: BlockRegistry
  let generator: CppGenerator

  beforeEach(() => {
    registry = new BlockRegistry()
    const allBlocks = [...universalBlocks, ...basicBlocks, ...advancedBlocks, ...specialBlocks] as BlockSpec[]
    allBlocks.forEach(spec => registry.register(spec))
    const adapter = new CppLanguageAdapter()
    generator = new CppGenerator(registry, adapter)
  })

  describe('完整程式產生', () => {
    it('should generate a complete Hello World program', () => {
      const workspace = {
        blocks: {
          languageVersion: 0,
          blocks: [
            {
              type: 'c_include',
              id: 'inc1',
              fields: { HEADER: 'stdio.h' },
              next: {
                block: {
                  type: 'u_func_def',
                  id: 'main',
                  fields: { RETURN_TYPE: 'int', NAME: 'main', PARAMS: '' },
                  inputs: {
                    BODY: {
                      block: {
                        type: 'c_printf',
                        id: 'p1',
                        fields: { FORMAT: 'Hello, World!\\n', ARGS: '' },
                        next: {
                          block: {
                            type: 'u_return',
                            id: 'r1',
                            inputs: {
                              VALUE: { block: { type: 'u_number', id: 'n0', fields: { NUM: 0 } } },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          ],
        },
      }

      const code = generator.generate(workspace)
      expect(code).toContain('#include <stdio.h>')
      expect(code).toContain('int main()')
      expect(code).toContain('printf("Hello, World!\\n")')
      expect(code).toContain('return 0;')
    })

    it('should generate a for-loop program with printf', () => {
      const workspace = {
        blocks: {
          languageVersion: 0,
          blocks: [{
            type: 'c_for_loop',
            id: 'for1',
            inputs: {
              INIT: { block: { type: 'c_raw_expression', id: 'init', fields: { CODE: 'int i = 0' } } },
              COND: {
                block: {
                  type: 'u_compare',
                  id: 'cond',
                  fields: { OP: '<' },
                  inputs: {
                    A: { block: { type: 'u_var_ref', id: 'i', fields: { NAME: 'i' } } },
                    B: { block: { type: 'u_number', id: 'n10', fields: { NUM: 10 } } },
                  },
                },
              },
              UPDATE: { block: { type: 'c_increment', id: 'inc', fields: { NAME: 'i', OP: '++' } } },
              BODY: {
                block: {
                  type: 'c_printf',
                  id: 'pf',
                  fields: { FORMAT: '%d\\n', ARGS: ', i' },
                },
              },
            },
          }],
        },
      }

      const code = generator.generate(workspace)
      expect(code).toContain('#include <stdio.h>')
      expect(code).toContain('for (int i = 0; i < 10; i++)')
      expect(code).toContain('printf("%d\\n", i)')
    })

  })

  describe('多積木組合', () => {
    it('should generate if-else with variable and comparison', () => {
      const workspace = {
        blocks: {
          languageVersion: 0,
          blocks: [{
            type: 'u_if_else',
            id: 'if1',
            inputs: {
              COND: {
                block: {
                  type: 'u_compare',
                  id: 'cmp',
                  fields: { OP: '>=' },
                  inputs: {
                    A: { block: { type: 'u_var_ref', id: 'v1', fields: { NAME: 'score' } } },
                    B: { block: { type: 'u_number', id: 'n60', fields: { NUM: 60 } } },
                  },
                },
              },
              THEN: {
                block: {
                  type: 'c_printf',
                  id: 'p1',
                  fields: { FORMAT: 'Pass\\n', ARGS: '' },
                },
              },
              ELSE: {
                block: {
                  type: 'c_printf',
                  id: 'p2',
                  fields: { FORMAT: 'Fail\\n', ARGS: '' },
                },
              },
            },
          }],
        },
      }

      const code = generator.generate(workspace)
      expect(code).toContain('if (score >= 60)')
      expect(code).toContain('printf("Pass\\n")')
      expect(code).toContain('else')
      expect(code).toContain('printf("Fail\\n")')
    })

    it('should handle vector declaration and push_back', () => {
      const workspace = {
        blocks: {
          languageVersion: 0,
          blocks: [{
            type: 'cpp_vector_declare',
            id: 'v1',
            fields: { TYPE: 'int', NAME: 'nums' },
            next: {
              block: {
                type: 'cpp_vector_push_back',
                id: 'pb1',
                fields: { VECTOR: 'nums' },
                inputs: {
                  VALUE: { block: { type: 'u_number', id: 'n42', fields: { NUM: 42 } } },
                },
              },
            },
          }],
        },
      }

      const code = generator.generate(workspace)
      expect(code).toContain('#include <vector>')
      expect(code).toContain('std::vector<int> nums;')
      expect(code).toContain('nums.push_back(42);')
    })
  })

  describe('#include 自動收集', () => {
    it('should collect imports from nested blocks', () => {
      const workspace = {
        blocks: {
          languageVersion: 0,
          blocks: [{
            type: 'u_func_def',
            id: 'fn',
            fields: { RETURN_TYPE: 'void', NAME: 'test', PARAMS: '' },
            inputs: {
              BODY: {
                block: {
                  type: 'c_printf',
                  id: 'p1',
                  fields: { FORMAT: 'test\\n', ARGS: '' },
                },
              },
            },
          }],
        },
      }

      const code = generator.generate(workspace)
      expect(code).toContain('#include <stdio.h>')
    })

    it('should collect multiple different imports', () => {
      const workspace = {
        blocks: {
          languageVersion: 0,
          blocks: [{
            type: 'cpp_sort',
            id: 's1',
            inputs: {
              BEGIN: { block: { type: 'c_raw_expression', id: 'b', fields: { CODE: 'v.begin()' } } },
              END: { block: { type: 'c_raw_expression', id: 'e', fields: { CODE: 'v.end()' } } },
            },
            next: {
              block: {
                type: 'c_printf',
                id: 'p1',
                fields: { FORMAT: 'sorted\\n', ARGS: '' },
              },
            },
          }],
        },
      }

      const code = generator.generate(workspace)
      expect(code).toContain('#include <algorithm>')
      expect(code).toContain('#include <stdio.h>')
    })
  })

  describe('使用全部積木定義載入', () => {
    it('should load all block specs without errors', () => {
      expect(registry.getByCategory('data').length).toBeGreaterThan(0)
      expect(registry.getByCategory('operators').length).toBeGreaterThan(0)
      expect(registry.getByCategory('conditions').length).toBeGreaterThan(0)
      expect(registry.getByCategory('loops').length).toBeGreaterThan(0)
      expect(registry.getByCategory('io').length).toBeGreaterThan(0)
      expect(registry.getByCategory('functions').length).toBeGreaterThan(0)
    })

    it('should have unique block IDs across all JSON files', () => {
      const allIds = [...basicBlocks, ...advancedBlocks, ...specialBlocks].map(b => b.id)
      const uniqueIds = new Set(allIds)
      expect(uniqueIds.size).toBe(allIds.length)
    })
  })

  describe('T019: Universal blocks → C++ code via adapter', () => {
    it('u_var_declare → int x = 0;', () => {
      const ws = {
        blocks: { languageVersion: 0, blocks: [{
          type: 'u_var_declare', id: 'b1',
          fields: { TYPE: 'int', NAME: 'x' },
          inputs: { INIT: { block: { type: 'u_number', id: 'b2', fields: { NUM: 0 } } } },
        }] },
      }
      const code = generator.generate(ws)
      expect(code).toContain('int x = 0;')
    })

    it('u_count_loop → for (int i = 0; i <= 10; i++) (inclusive endpoint)', () => {
      const ws = {
        blocks: { languageVersion: 0, blocks: [{
          type: 'u_count_loop', id: 'b1',
          fields: { VAR: 'i' },
          inputs: {
            FROM: { block: { type: 'u_number', id: 'b2', fields: { NUM: 0 } } },
            TO: { block: { type: 'u_number', id: 'b3', fields: { NUM: 10 } } },
            BODY: { block: { type: 'u_break', id: 'b4' } },
          },
        }] },
      }
      const code = generator.generate(ws)
      expect(code).toContain('for (int i = 0; i <= 10; i++)')
      expect(code).toContain('break;')
    })

    it('u_print → cout << ... with #include <iostream>', () => {
      const ws = {
        blocks: { languageVersion: 0, blocks: [{
          type: 'u_print', id: 'b1',
          inputs: {
            EXPR0: { block: { type: 'u_var_ref', id: 'vx', fields: { NAME: 'x' } } },
            EXPR1: { block: { type: 'u_endl', id: 'endl1' } },
          },
        }] },
      }
      const code = generator.generate(ws)
      expect(code).toContain('#include <iostream>')
      expect(code).toContain('cout << x << endl;')
    })

    it('u_print with multiple expressions → cout << a << b << endl', () => {
      const ws = {
        blocks: { languageVersion: 0, blocks: [{
          type: 'u_print', id: 'b1',
          inputs: {
            EXPR0: { block: { type: 'u_string', id: 's1', fields: { TEXT: '#' } } },
            EXPR1: { block: { type: 'u_var_ref', id: 'vi', fields: { NAME: 'i' } } },
            EXPR2: { block: { type: 'u_endl', id: 'endl1' } },
          },
        }] },
      }
      const code = generator.generate(ws)
      expect(code).toContain('cout << "#" << i << endl;')
    })

    it('u_if_else → if/else structure', () => {
      const ws = {
        blocks: { languageVersion: 0, blocks: [{
          type: 'u_if_else', id: 'b1',
          inputs: {
            COND: { block: {
              type: 'u_compare', id: 'b2',
              fields: { OP: '>' },
              inputs: {
                A: { block: { type: 'u_var_ref', id: 'b3', fields: { NAME: 'x' } } },
                B: { block: { type: 'u_number', id: 'b4', fields: { NUM: 0 } } },
              },
            }},
            THEN: { block: { type: 'u_return', id: 'b5', inputs: { VALUE: { block: { type: 'u_number', id: 'b6', fields: { NUM: 1 } } } } } },
            ELSE: { block: { type: 'u_return', id: 'b7', inputs: { VALUE: { block: { type: 'u_number', id: 'b8', fields: { NUM: 0 } } } } } },
          },
        }] },
      }
      const code = generator.generate(ws)
      expect(code).toContain('if (x > 0)')
      expect(code).toContain('return 1;')
      expect(code).toContain('else')
      expect(code).toContain('return 0;')
    })

    it('u_func_def with 0 params → void f()', () => {
      const ws = {
        blocks: { languageVersion: 0, blocks: [{
          type: 'u_func_def', id: 'b1',
          fields: { NAME: 'f', RETURN_TYPE: 'void' },
          inputs: {},
        }] },
      }
      const code = generator.generate(ws)
      expect(code).toContain('void f()')
    })

    it('u_func_def with 2 dynamic params → int add(int a, int b)', () => {
      const ws = {
        blocks: { languageVersion: 0, blocks: [{
          type: 'u_func_def', id: 'b1',
          fields: { NAME: 'add', RETURN_TYPE: 'int', TYPE_0: 'int', PARAM_0: 'a', TYPE_1: 'int', PARAM_1: 'b' },
          inputs: {
            BODY: { block: { type: 'u_return', id: 'b2', inputs: { VALUE: { block: { type: 'u_number', id: 'b3', fields: { NUM: 0 } } } } } },
          },
        }] },
      }
      const code = generator.generate(ws)
      expect(code).toContain('int add(int a, int b)')
      expect(code).toContain('return 0;')
    })

    it('u_func_call with 0 args → func()', () => {
      const ws = {
        blocks: { languageVersion: 0, blocks: [{
          type: 'u_func_call', id: 'b1',
          fields: { NAME: 'func' },
          inputs: {},
        }] },
      }
      const code = generator.generate(ws)
      expect(code).toContain('func()')
    })

    it('u_func_call with 2 dynamic args → add(x, y)', () => {
      const ws = {
        blocks: { languageVersion: 0, blocks: [{
          type: 'u_func_call', id: 'b1',
          fields: { NAME: 'add' },
          inputs: {
            ARG0: { block: { type: 'u_var_ref', id: 'a', fields: { NAME: 'x' } } },
            ARG1: { block: { type: 'u_var_ref', id: 'b', fields: { NAME: 'y' } } },
          },
        }] },
      }
      const code = generator.generate(ws)
      expect(code).toContain('add(x, y)')
    })

    it('u_input → cin >> name with #include <iostream>', () => {
      const ws = {
        blocks: { languageVersion: 0, blocks: [{
          type: 'u_input', id: 'b1',
          fields: { NAME: 'x' },
        }] },
      }
      const code = generator.generate(ws)
      expect(code).toContain('#include <iostream>')
      expect(code).toContain('cin >> x;')
    })

    it('u_input with 3 dynamic vars → cin >> a >> b >> c;', () => {
      const ws = {
        blocks: { languageVersion: 0, blocks: [{
          type: 'u_input', id: 'b1',
          fields: { NAME_0: 'a', NAME_1: 'b', NAME_2: 'c' },
        }] },
      }
      const code = generator.generate(ws)
      expect(code).toContain('#include <iostream>')
      expect(code).toContain('cin >> a >> b >> c;')
    })

    it('u_input with 1 dynamic var → cin >> x;', () => {
      const ws = {
        blocks: { languageVersion: 0, blocks: [{
          type: 'u_input', id: 'b1',
          fields: { NAME_0: 'x' },
        }] },
      }
      const code = generator.generate(ws)
      expect(code).toContain('cin >> x;')
    })

    it('u_var_declare INIT_MODE=no_init → int x;', () => {
      const ws = {
        blocks: { languageVersion: 0, blocks: [{
          type: 'u_var_declare', id: 'b1',
          fields: { TYPE: 'int', NAME: 'x', INIT_MODE: 'no_init' },
        }] },
      }
      const code = generator.generate(ws)
      expect(code).toContain('int x;')
      expect(code).not.toContain('=')
    })

    it('u_var_declare INIT_MODE=with_init → int x = 5;', () => {
      const ws = {
        blocks: { languageVersion: 0, blocks: [{
          type: 'u_var_declare', id: 'b1',
          fields: { TYPE: 'int', NAME: 'x', INIT_MODE: 'with_init' },
          inputs: { INIT: { block: { type: 'u_number', id: 'b2', fields: { NUM: 5 } } } },
        }] },
      }
      const code = generator.generate(ws)
      expect(code).toContain('int x = 5;')
    })
  })
})
