import { describe, it, expect, beforeEach } from 'vitest'
import { PatternLifter } from '../../../src/core/lift/pattern-lifter'
import type { AstNode, LiftContext } from '../../../src/core/lift/types'
import type { BlockSpec, LiftPattern } from '../../../src/core/types'
import { LiftContextData } from '../../../src/core/lift/lift-context'

// Helper to create mock AST nodes
function mockNode(
  type: string,
  text: string,
  children: AstNode[] = [],
  fields: Record<string, AstNode | null> = {},
): AstNode {
  const namedChildren = children.filter(c => c.isNamed)
  return {
    type,
    text,
    isNamed: true,
    children,
    namedChildren,
    childForFieldName: (name: string) => fields[name] ?? null,
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 0, column: text.length },
  }
}

function unnamed(type: string, text: string): AstNode {
  return { ...mockNode(type, text), isNamed: false }
}

function makeLiftContext(lifter: PatternLifter): LiftContext {
  const contextData = new LiftContextData()
  return {
    lift: (n) => lifter.tryLift(n, makeLiftContext(lifter)),
    liftChildren: (nodes) => nodes.map(n => lifter.tryLift(n, makeLiftContext(lifter))).filter((r): r is NonNullable<typeof r> => r !== null),
    data: contextData,
  }
}

describe('PatternLifter', () => {
  let lifter: PatternLifter

  beforeEach(() => {
    lifter = new PatternLifter()
  })

  describe('simple pattern (from BlockSpec astPattern)', () => {
    it('should lift a simple nodeType match with fieldMappings', () => {
      const spec: BlockSpec = {
        id: 'c_char_literal',
        language: 'cpp',
        category: 'values',
        level: 1,
        version: '1.0.0',
        concept: {
          conceptId: 'cpp_char_literal',
          abstractConcept: 'char_literal',
          properties: ['char'],
          role: 'expression',
        },
        blockDef: { type: 'c_char_literal' },
        codeTemplate: { pattern: "'${CHAR}'", imports: [], order: 20 },
        astPattern: {
          nodeType: 'char_literal',
          constraints: [],
          fieldMappings: [
            { semantic: 'char', ast: '$text', extract: 'text' },
          ],
        },
      }
      lifter.loadBlockSpecs([spec])

      const node = mockNode('char_literal', "'a'")
      const ctx = makeLiftContext(lifter)
      const result = lifter.tryLift(node, ctx)

      expect(result).not.toBeNull()
      expect(result!.concept).toBe('cpp_char_literal')
      expect(result!.properties.char).toBe("'a'")
    })

    it('should lift with field_name based fieldMappings', () => {
      const spec: BlockSpec = {
        id: 'c_increment',
        language: 'cpp',
        category: 'operators',
        level: 1,
        version: '1.0.0',
        concept: {
          conceptId: 'cpp_increment',
          abstractConcept: 'increment',
          properties: ['name', 'operator'],
          role: 'both',
        },
        blockDef: { type: 'c_increment' },
        codeTemplate: { pattern: '${NAME}${OP}', imports: [], order: 8 },
        astPattern: {
          nodeType: 'update_expression',
          constraints: [],
          fieldMappings: [
            { semantic: 'name', ast: 'argument', extract: 'text' },
            { semantic: 'operator', ast: '$operator', extract: 'text' },
          ],
        },
      }
      lifter.loadBlockSpecs([spec])

      const argNode = mockNode('identifier', 'i')
      const opNode = unnamed('++', '++')
      const node = mockNode('update_expression', 'i++', [argNode, opNode], {
        argument: argNode,
      })
      // For $operator extraction, we need unnamed children
      const ctx = makeLiftContext(lifter)
      const result = lifter.tryLift(node, ctx)

      expect(result).not.toBeNull()
      expect(result!.concept).toBe('cpp_increment')
      expect(result!.properties.name).toBe('i')
    })
  })

  describe('constrained pattern', () => {
    it('should match nodeType + field text constraint', () => {
      const spec: BlockSpec = {
        id: 'c_printf',
        language: 'cpp',
        category: 'io',
        level: 1,
        version: '1.0.0',
        concept: {
          conceptId: 'cpp_printf',
          abstractConcept: 'printf',
          properties: ['format', 'args'],
          role: 'statement',
        },
        blockDef: { type: 'c_printf' },
        codeTemplate: { pattern: 'printf("${FORMAT}"${ARGS});', imports: ['stdio.h'], order: 0 },
        astPattern: {
          nodeType: 'call_expression',
          constraints: [{ field: 'function', text: 'printf' }],
        },
      }
      lifter.loadBlockSpecs([spec])

      const funcNode = mockNode('identifier', 'printf')
      const node = mockNode('call_expression', 'printf("%d", x)', [], {
        function: funcNode,
      })
      const ctx = makeLiftContext(lifter)
      const result = lifter.tryLift(node, ctx)

      expect(result).not.toBeNull()
      expect(result!.concept).toBe('cpp_printf')
    })

    it('should NOT match when constraint fails', () => {
      const spec: BlockSpec = {
        id: 'c_printf',
        language: 'cpp',
        category: 'io',
        level: 1,
        version: '1.0.0',
        concept: {
          conceptId: 'cpp_printf',
          abstractConcept: 'printf',
          properties: ['format', 'args'],
          role: 'statement',
        },
        blockDef: { type: 'c_printf' },
        codeTemplate: { pattern: 'printf("${FORMAT}"${ARGS});', imports: [], order: 0 },
        astPattern: {
          nodeType: 'call_expression',
          constraints: [{ field: 'function', text: 'printf' }],
        },
      }
      lifter.loadBlockSpecs([spec])

      const funcNode = mockNode('identifier', 'scanf')
      const node = mockNode('call_expression', 'scanf("%d", &x)', [], {
        function: funcNode,
      })
      const ctx = makeLiftContext(lifter)
      const result = lifter.tryLift(node, ctx)
      expect(result).toBeNull()
    })

    it('should prefer more constrained pattern over less constrained', () => {
      const genericSpec: BlockSpec = {
        id: 'generic_call',
        language: 'cpp',
        category: 'functions',
        level: 1,
        version: '1.0.0',
        concept: { conceptId: 'generic_call', role: 'expression' },
        blockDef: { type: 'generic_call' },
        codeTemplate: { pattern: '${NAME}()', imports: [], order: 20 },
        astPattern: { nodeType: 'call_expression', constraints: [] },
      }
      const printfSpec: BlockSpec = {
        id: 'c_printf',
        language: 'cpp',
        category: 'io',
        level: 1,
        version: '1.0.0',
        concept: { conceptId: 'cpp_printf', role: 'statement' },
        blockDef: { type: 'c_printf' },
        codeTemplate: { pattern: 'printf("${FORMAT}"${ARGS});', imports: [], order: 0 },
        astPattern: {
          nodeType: 'call_expression',
          constraints: [{ field: 'function', text: 'printf' }],
        },
      }
      lifter.loadBlockSpecs([genericSpec, printfSpec])

      const funcNode = mockNode('identifier', 'printf')
      const node = mockNode('call_expression', 'printf("%d", x)', [], {
        function: funcNode,
      })
      const ctx = makeLiftContext(lifter)
      const result = lifter.tryLift(node, ctx)

      expect(result).not.toBeNull()
      expect(result!.concept).toBe('cpp_printf')
    })
  })

  describe('lift extract modes', () => {
    it('should extract "lift" mode - recursively lift a child', () => {
      const parentSpec: BlockSpec = {
        id: 'c_compound_assign',
        language: 'cpp',
        category: 'operators',
        level: 1,
        version: '1.0.0',
        concept: {
          conceptId: 'cpp_compound_assign',
          abstractConcept: 'compound_assign',
          properties: ['name', 'operator'],
          children: { value: 'expression' },
          role: 'statement',
        },
        blockDef: { type: 'c_compound_assign' },
        codeTemplate: { pattern: '${NAME} ${OP} ${VALUE};', imports: [], order: 0 },
        astPattern: {
          nodeType: 'assignment_expression',
          constraints: [],
          fieldMappings: [
            { semantic: 'name', ast: 'left', extract: 'text' },
            { semantic: 'operator', ast: '$operator', extract: 'text' },
            { semantic: 'value', ast: 'right', extract: 'lift' },
          ],
        },
      }
      // Also register number_literal for lifting the right side
      const numSpec: BlockSpec = {
        id: 'u_number',
        language: 'universal',
        category: 'data',
        level: 0,
        version: '1.0.0',
        concept: { conceptId: 'number_literal', role: 'expression' },
        blockDef: { type: 'u_number' },
        codeTemplate: { pattern: '${NUM}', imports: [], order: 20 },
        astPattern: {
          nodeType: 'number_literal',
          constraints: [],
          fieldMappings: [
            { semantic: 'value', ast: '$text', extract: 'text' },
          ],
        },
      }
      lifter.loadBlockSpecs([parentSpec, numSpec])

      const leftNode = mockNode('identifier', 'x')
      const opNode = unnamed('+=', '+=')
      const rightNode = mockNode('number_literal', '5')
      const node = mockNode('assignment_expression', 'x += 5', [leftNode, opNode, rightNode], {
        left: leftNode,
        right: rightNode,
      })
      const ctx = makeLiftContext(lifter)
      const result = lifter.tryLift(node, ctx)

      expect(result).not.toBeNull()
      expect(result!.concept).toBe('cpp_compound_assign')
      expect(result!.properties.name).toBe('x')
      expect(result!.children.value).toHaveLength(1)
      expect(result!.children.value[0].concept).toBe('number_literal')
    })
  })

  describe('LiftPattern - operatorDispatch', () => {
    it('should dispatch binary_expression to different concepts by operator', () => {
      const pattern: LiftPattern = {
        id: 'binary_dispatch',
        astNodeType: 'binary_expression',
        patternType: 'operatorDispatch',
        operatorDispatch: {
          operatorField: '$operator',
          routes: {
            '+': 'arithmetic',
            '-': 'arithmetic',
            '*': 'arithmetic',
            '/': 'arithmetic',
            '%': 'arithmetic',
            '>': 'compare',
            '<': 'compare',
            '>=': 'compare',
            '<=': 'compare',
            '==': 'compare',
            '!=': 'compare',
            '&&': 'logic',
            '||': 'logic',
          },
          fieldMappings: [
            { semantic: 'operator', ast: '$operator', extract: 'text' },
            { semantic: 'left', ast: 'left', extract: 'lift' },
            { semantic: 'right', ast: 'right', extract: 'lift' },
          ],
        },
      }

      // Register number_literal for child lifting
      const numSpec: BlockSpec = {
        id: 'u_number',
        language: 'universal',
        category: 'data',
        level: 0,
        version: '1.0.0',
        concept: { conceptId: 'number_literal', role: 'expression' },
        blockDef: { type: 'u_number' },
        codeTemplate: { pattern: '${NUM}', imports: [], order: 20 },
        astPattern: {
          nodeType: 'number_literal',
          constraints: [],
          fieldMappings: [{ semantic: 'value', ast: '$text', extract: 'text' }],
        },
      }
      lifter.loadBlockSpecs([numSpec])
      lifter.loadLiftPatterns([pattern])

      // Test arithmetic
      const left = mockNode('number_literal', '3')
      const right = mockNode('number_literal', '5')
      const opPlus = unnamed('+', '+')
      const addNode = mockNode('binary_expression', '3 + 5', [left, opPlus, right], {
        left, right,
      })
      const ctx = makeLiftContext(lifter)
      const addResult = lifter.tryLift(addNode, ctx)
      expect(addResult).not.toBeNull()
      expect(addResult!.concept).toBe('arithmetic')
      expect(addResult!.properties.operator).toBe('+')
      expect(addResult!.children.left).toHaveLength(1)
      expect(addResult!.children.right).toHaveLength(1)

      // Test compare
      const opGt = unnamed('>', '>')
      const cmpNode = mockNode('binary_expression', '3 > 5', [left, opGt, right], {
        left, right,
      })
      const cmpResult = lifter.tryLift(cmpNode, makeLiftContext(lifter))
      expect(cmpResult).not.toBeNull()
      expect(cmpResult!.concept).toBe('compare')
      expect(cmpResult!.properties.operator).toBe('>')

      // Test logic
      const opAnd = unnamed('&&', '&&')
      const logicNode = mockNode('binary_expression', '3 && 5', [left, opAnd, right], {
        left, right,
      })
      const logicResult = lifter.tryLift(logicNode, makeLiftContext(lifter))
      expect(logicResult).not.toBeNull()
      expect(logicResult!.concept).toBe('logic')
    })
  })

  describe('LiftPattern - chain', () => {
    it('should detect cout << chain and produce print concept', () => {
      const pattern: LiftPattern = {
        id: 'cout_chain',
        astNodeType: 'binary_expression',
        patternType: 'chain',
        concept: { conceptId: 'print' },
        chain: {
          operator: '<<',
          direction: 'left',
          rootMatch: { text: 'cout' },
          collectField: 'right',
        },
        priority: 10,
      }
      lifter.loadLiftPatterns([pattern])

      // Register specs for child lifting
      const idSpec: BlockSpec = {
        id: 'u_var_ref',
        language: 'universal',
        category: 'data',
        level: 0,
        version: '1.0.0',
        concept: { conceptId: 'var_ref', role: 'expression' },
        blockDef: { type: 'u_var_ref' },
        codeTemplate: { pattern: '${NAME}', imports: [], order: 20 },
        astPattern: {
          nodeType: 'identifier',
          constraints: [],
          fieldMappings: [{ semantic: 'name', ast: '$text', extract: 'text' }],
        },
      }
      lifter.loadBlockSpecs([idSpec])

      // Build: cout << x << y
      // AST: binary_expression(binary_expression(cout, <<, x), <<, y)
      const coutNode = mockNode('identifier', 'cout')
      const xNode = mockNode('identifier', 'x')
      const yNode = mockNode('identifier', 'y')
      const opShift = unnamed('<<', '<<')

      const innerBinExpr = mockNode('binary_expression', 'cout << x', [coutNode, opShift, xNode], {
        left: coutNode,
        right: xNode,
      })
      const outerBinExpr = mockNode('binary_expression', 'cout << x << y', [innerBinExpr, opShift, yNode], {
        left: innerBinExpr,
        right: yNode,
      })

      const ctx = makeLiftContext(lifter)
      const result = lifter.tryLift(outerBinExpr, ctx)

      expect(result).not.toBeNull()
      expect(result!.concept).toBe('print')
      expect(result!.children.values).toBeDefined()
      expect(result!.children.values.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('LiftPattern - composite', () => {
    it('should detect counting for-loop pattern', () => {
      const pattern: LiftPattern = {
        id: 'count_for',
        astNodeType: 'for_statement',
        patternType: 'composite',
        concept: { conceptId: 'count_loop' },
        composite: {
          checks: [
            { field: 'initializer', typeIs: 'declaration' },
            { field: 'condition', typeIs: 'binary_expression' },
            { field: 'update', typeIs: 'update_expression' },
          ],
          extract: {
            variable: { source: 'path', path: 'initializer.declarator.text' },
            from: { source: 'lift', path: 'initializer.value' },
            to: { source: 'lift', path: 'condition.right' },
            body: { source: 'liftBody', path: 'body' },
          },
        },
        priority: 10,
      }

      // Register number spec for child lifting
      const numSpec: BlockSpec = {
        id: 'u_number',
        language: 'universal',
        category: 'data',
        level: 0,
        version: '1.0.0',
        concept: { conceptId: 'number_literal', role: 'expression' },
        blockDef: { type: 'u_number' },
        codeTemplate: { pattern: '${NUM}', imports: [], order: 20 },
        astPattern: {
          nodeType: 'number_literal',
          constraints: [],
          fieldMappings: [{ semantic: 'value', ast: '$text', extract: 'text' }],
        },
      }
      lifter.loadBlockSpecs([numSpec])
      lifter.loadLiftPatterns([pattern])

      // Build: for (int i = 0; i < 10; i++) { ... }
      const iDecl = mockNode('identifier', 'i')
      const zeroNode = mockNode('number_literal', '0')
      const initDeclarator = mockNode('init_declarator', 'i = 0', [iDecl, unnamed('=', '='), zeroNode], {
        declarator: iDecl,
        value: zeroNode,
      })
      const initNode = mockNode('declaration', 'int i = 0', [
        mockNode('primitive_type', 'int'),
        initDeclarator,
      ], {
        declarator: iDecl,
        value: zeroNode,
      })

      const condLeft = mockNode('identifier', 'i')
      const tenNode = mockNode('number_literal', '10')
      const condNode = mockNode('binary_expression', 'i < 10', [condLeft, unnamed('<', '<'), tenNode], {
        left: condLeft,
        right: tenNode,
      })

      const updateNode = mockNode('update_expression', 'i++', [mockNode('identifier', 'i'), unnamed('++', '++')])

      const bodyNode = mockNode('compound_statement', '{}', [])

      const forNode = mockNode('for_statement', 'for (int i = 0; i < 10; i++) {}',
        [initNode, condNode, updateNode, bodyNode],
        {
          initializer: initNode,
          condition: condNode,
          update: updateNode,
          body: bodyNode,
        },
      )

      const ctx = makeLiftContext(lifter)
      const result = lifter.tryLift(forNode, ctx)

      expect(result).not.toBeNull()
      expect(result!.concept).toBe('count_loop')
    })

    it('should NOT match when composite checks fail', () => {
      const pattern: LiftPattern = {
        id: 'count_for',
        astNodeType: 'for_statement',
        patternType: 'composite',
        concept: { conceptId: 'count_loop' },
        composite: {
          checks: [
            { field: 'initializer', typeIs: 'declaration' },
            { field: 'condition', typeIs: 'binary_expression' },
            { field: 'update', typeIs: 'update_expression' },
          ],
          extract: {},
        },
        priority: 10,
      }
      lifter.loadLiftPatterns([pattern])

      // for loop with assignment instead of declaration in initializer
      const initNode = mockNode('assignment_expression', 'i = 0')
      const condNode = mockNode('binary_expression', 'i < 10')
      const updateNode = mockNode('update_expression', 'i++')
      const bodyNode = mockNode('compound_statement', '{}')

      const forNode = mockNode('for_statement', 'for (i = 0; i < 10; i++) {}',
        [initNode, condNode, updateNode, bodyNode],
        { initializer: initNode, condition: condNode, update: updateNode, body: bodyNode },
      )

      const ctx = makeLiftContext(lifter)
      const result = lifter.tryLift(forNode, ctx)
      expect(result).toBeNull()
    })
  })

  describe('LiftPattern - unwrap', () => {
    it('should unwrap parenthesized_expression transparently', () => {
      const pattern: LiftPattern = {
        id: 'unwrap_parens',
        astNodeType: 'parenthesized_expression',
        patternType: 'unwrap',
        unwrapChild: 0,
      }

      const numSpec: BlockSpec = {
        id: 'u_number',
        language: 'universal',
        category: 'data',
        level: 0,
        version: '1.0.0',
        concept: { conceptId: 'number_literal', role: 'expression' },
        blockDef: { type: 'u_number' },
        codeTemplate: { pattern: '${NUM}', imports: [], order: 20 },
        astPattern: {
          nodeType: 'number_literal',
          constraints: [],
          fieldMappings: [{ semantic: 'value', ast: '$text', extract: 'text' }],
        },
      }
      lifter.loadBlockSpecs([numSpec])
      lifter.loadLiftPatterns([pattern])

      const inner = mockNode('number_literal', '42')
      const parens = mockNode('parenthesized_expression', '(42)', [inner])

      const ctx = makeLiftContext(lifter)
      const result = lifter.tryLift(parens, ctx)

      expect(result).not.toBeNull()
      expect(result!.concept).toBe('number_literal')
      expect(result!.properties.value).toBe('42')
    })
  })

  describe('priority ordering', () => {
    it('should prefer lift patterns over block spec patterns for same nodeType', () => {
      // Block spec: simple pattern for for_statement
      const simpleForSpec: BlockSpec = {
        id: 'c_for_loop',
        language: 'cpp',
        category: 'loops',
        level: 1,
        version: '1.0.0',
        concept: { conceptId: 'cpp_for_loop', role: 'statement' },
        blockDef: { type: 'c_for_loop' },
        codeTemplate: { pattern: 'for (...) { ... }', imports: [], order: 0 },
        astPattern: { nodeType: 'for_statement', constraints: [] },
      }

      // Lift pattern: composite for count_loop
      const compositePattern: LiftPattern = {
        id: 'count_for',
        astNodeType: 'for_statement',
        patternType: 'composite',
        concept: { conceptId: 'count_loop' },
        composite: {
          checks: [
            { field: 'initializer', typeIs: 'declaration' },
            { field: 'condition', typeIs: 'binary_expression' },
            { field: 'update', typeIs: 'update_expression' },
          ],
          extract: {},
        },
        priority: 10,
      }

      lifter.loadBlockSpecs([simpleForSpec])
      lifter.loadLiftPatterns([compositePattern])

      // This should match composite (count_loop), not simple (cpp_for_loop)
      const initNode = mockNode('declaration', 'int i = 0')
      const condNode = mockNode('binary_expression', 'i < 10')
      const updateNode = mockNode('update_expression', 'i++')
      const bodyNode = mockNode('compound_statement', '{}')

      const forNode = mockNode('for_statement', 'for (int i = 0; i < 10; i++) {}',
        [initNode, condNode, updateNode, bodyNode],
        { initializer: initNode, condition: condNode, update: updateNode, body: bodyNode },
      )

      const ctx = makeLiftContext(lifter)
      const result = lifter.tryLift(forNode, ctx)

      expect(result).not.toBeNull()
      expect(result!.concept).toBe('count_loop')
    })
  })
})
