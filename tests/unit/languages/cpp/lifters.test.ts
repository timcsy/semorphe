import { describe, it, expect, beforeAll } from 'vitest'
import { Lifter } from '../../../../src/core/lift/lifter'
import type { AstNode } from '../../../../src/core/lift/types'
import { createTestLifter } from '../../../helpers/setup-lifter'

function mockNode(type: string, text: string, children: AstNode[] = [], fields: Record<string, AstNode | null> = {}): AstNode {
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

let lifter: Lifter

beforeAll(() => {
  lifter = createTestLifter()
})

describe('C++ Declaration Lifters', () => {
  it('should lift declaration with init to var_declare with initializer', () => {
    const numNode = mockNode('number_literal', '42')
    const initDecl = mockNode('init_declarator', 'x = 42', [
      mockNode('identifier', 'x'),
      unnamed('=', '='),
      numNode,
    ], { declarator: mockNode('identifier', 'x'), value: numNode })

    const node = mockNode('declaration', 'int x = 42;', [
      mockNode('primitive_type', 'int'),
      initDecl,
    ])
    const result = lifter.lift(node)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('var_declare')
    expect(result!.properties.name).toBe('x')
    expect(result!.properties.type).toBe('int')
    expect(result!.children.initializer).toHaveLength(1)
    expect(result!.children.initializer[0].concept).toBe('number_literal')
  })

  it('should lift declaration without init to var_declare', () => {
    const node = mockNode('declaration', 'int y;', [
      mockNode('primitive_type', 'int'),
      mockNode('identifier', 'y'),
    ])
    const result = lifter.lift(node)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('var_declare')
    expect(result!.properties.name).toBe('y')
    expect(result!.properties.type).toBe('int')
  })

  it('should lift array declaration', () => {
    const arrDecl = mockNode('array_declarator', 'arr[10]', [
      mockNode('identifier', 'arr'),
      mockNode('number_literal', '10'),
    ])
    const node = mockNode('declaration', 'int arr[10];', [
      mockNode('primitive_type', 'int'),
      arrDecl,
    ])
    const result = lifter.lift(node)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('array_declare')
    expect(result!.properties.name).toBe('arr')
    expect(result!.properties.size).toBe('10')
  })

  it('should lift expression_statement by unwrapping', () => {
    const inner = mockNode('identifier', 'x')
    const node = mockNode('expression_statement', 'x;', [inner])
    const result = lifter.lift(node)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('var_ref')
    expect(result!.properties.name).toBe('x')
  })

  it('should lift assignment_expression to var_assign', () => {
    const left = mockNode('identifier', 'x')
    const right = mockNode('number_literal', '10')
    const node = mockNode('assignment_expression', 'x = 10', [left, unnamed('=', '='), right], {
      left, right,
    })
    const result = lifter.lift(node)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('var_assign')
    expect(result!.properties.name).toBe('x')
    expect(result!.children.value).toHaveLength(1)
  })
})

describe('C++ Expression Lifters', () => {
  it('should lift char_literal to string_literal', () => {
    const node = mockNode('char_literal', "'a'")
    const result = lifter.lift(node)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('string_literal')
    expect(result!.properties.value).toBe('a')
  })

  it('should lift true/false to var_ref', () => {
    const trueNode = mockNode('true', 'true')
    const falseNode = mockNode('false', 'false')
    expect(lifter.lift(trueNode)!.concept).toBe('var_ref')
    expect(lifter.lift(trueNode)!.properties.name).toBe('true')
    expect(lifter.lift(falseNode)!.properties.name).toBe('false')
  })

  it('should lift unary ! to logic_not', () => {
    const operand = mockNode('identifier', 'x')
    const node = mockNode('unary_expression', '!x', [
      unnamed('!', '!'),
      operand,
    ], { argument: operand })
    const result = lifter.lift(node)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('logic_not')
    expect(result!.children.operand).toHaveLength(1)
  })

  it('should lift unary - to negate', () => {
    const operand = mockNode('number_literal', '5')
    const node = mockNode('unary_expression', '-5', [
      unnamed('-', '-'),
      operand,
    ], { argument: operand })
    const result = lifter.lift(node)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('negate')
    expect(result!.children.value).toHaveLength(1)
  })

  it('should degrade unknown unary op (++) to raw_code', () => {
    const operand = mockNode('identifier', 'i')
    const node = mockNode('unary_expression', '++i', [
      unnamed('++', '++'),
      operand,
    ], { argument: operand })
    const result = lifter.lift(node)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('raw_code')
  })

  it('should lift parenthesized_expression by unwrapping', () => {
    const inner = mockNode('number_literal', '42')
    const node = mockNode('parenthesized_expression', '(42)', [inner])
    const result = lifter.lift(node)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('number_literal')
    expect(result!.properties.value).toBe('42')
  })

  it('should lift subscript_expression to array_access', () => {
    const arr = mockNode('identifier', 'arr')
    const idx = mockNode('number_literal', '3')
    const node = mockNode('subscript_expression', 'arr[3]', [arr, idx], {
      argument: arr, index: idx,
    })
    const result = lifter.lift(node)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('array_access')
    expect(result!.properties.name).toBe('arr')
    expect(result!.children.index).toHaveLength(1)
  })
})

describe('C++ Statement Lifters', () => {
  it('should lift if_statement without else', () => {
    const cond = mockNode('condition_clause', '(x > 0)', [
      mockNode('binary_expression', 'x > 0', [
        mockNode('identifier', 'x'),
        unnamed('>', '>'),
        mockNode('number_literal', '0'),
      ], {
        left: mockNode('identifier', 'x'),
        right: mockNode('number_literal', '0'),
      }),
    ])
    const body = mockNode('compound_statement', '{ y = 1; }', [
      mockNode('expression_statement', 'y = 1;', [
        mockNode('assignment_expression', 'y = 1', [
          mockNode('identifier', 'y'),
          unnamed('=', '='),
          mockNode('number_literal', '1'),
        ], { left: mockNode('identifier', 'y'), right: mockNode('number_literal', '1') }),
      ]),
    ])
    const node = mockNode('if_statement', 'if (x > 0) { y = 1; }', [cond, body], {
      condition: cond,
      consequence: body,
      alternative: null,
    })
    const result = lifter.lift(node)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('if')
    expect(result!.children.condition).toHaveLength(1)
    expect(result!.children.then_body.length).toBeGreaterThan(0)
    expect(result!.children.else_body).toHaveLength(0)
  })

  it('should lift if_statement with else', () => {
    const cond = mockNode('condition_clause', '(x > 0)', [
      mockNode('identifier', 'x'),
    ])
    const thenBody = mockNode('compound_statement', '{}', [])
    const elseBody = mockNode('compound_statement', '{}', [
      mockNode('break_statement', 'break;'),
    ])
    const node = mockNode('if_statement', 'if (x > 0) {} else { break; }', [cond, thenBody, elseBody], {
      condition: cond,
      consequence: thenBody,
      alternative: elseBody,
    })
    const result = lifter.lift(node)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('if')
    expect(result!.children.else_body.length).toBeGreaterThan(0)
  })

  it('should lift while_statement', () => {
    const cond = mockNode('condition_clause', '(i < 10)', [
      mockNode('binary_expression', 'i < 10', [
        mockNode('identifier', 'i'),
        unnamed('<', '<'),
        mockNode('number_literal', '10'),
      ], {
        left: mockNode('identifier', 'i'),
        right: mockNode('number_literal', '10'),
      }),
    ])
    const body = mockNode('compound_statement', '{}', [])
    const node = mockNode('while_statement', 'while (i < 10) {}', [cond, body], {
      condition: cond,
      body: body,
    })
    const result = lifter.lift(node)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('while_loop')
    expect(result!.children.condition).toHaveLength(1)
  })

  it('should lift counting for_statement to count_loop', () => {
    const init = mockNode('declaration', 'int i = 0', [
      mockNode('primitive_type', 'int'),
      mockNode('init_declarator', 'i = 0', [
        mockNode('identifier', 'i'),
        unnamed('=', '='),
        mockNode('number_literal', '0'),
      ], { declarator: mockNode('identifier', 'i'), value: mockNode('number_literal', '0') }),
    ])
    const cond = mockNode('binary_expression', 'i < 10', [
      mockNode('identifier', 'i'),
      unnamed('<', '<'),
      mockNode('number_literal', '10'),
    ], { left: mockNode('identifier', 'i'), right: mockNode('number_literal', '10') })
    const update = mockNode('update_expression', 'i++', [mockNode('identifier', 'i')])
    const body = mockNode('compound_statement', '{}', [])
    const node = mockNode('for_statement', 'for (int i = 0; i < 10; i++) {}', [init, cond, update, body], {
      initializer: init,
      condition: cond,
      update: update,
      body: body,
    })
    const result = lifter.lift(node)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('count_loop')
    expect(result!.properties.var_name).toBe('i')
    expect(result!.children.from).toHaveLength(1)
    expect(result!.children.to).toHaveLength(1)
  })

  it('should detect inclusive count_loop (<=)', () => {
    const init = mockNode('declaration', 'int i = 1', [
      mockNode('primitive_type', 'int'),
      mockNode('init_declarator', 'i = 1', [
        mockNode('identifier', 'i'),
        unnamed('=', '='),
        mockNode('number_literal', '1'),
      ], { declarator: mockNode('identifier', 'i'), value: mockNode('number_literal', '1') }),
    ])
    const cond = mockNode('binary_expression', 'i <= 10', [
      mockNode('identifier', 'i'),
      unnamed('<=', '<='),
      mockNode('number_literal', '10'),
    ], { left: mockNode('identifier', 'i'), right: mockNode('number_literal', '10') })
    const update = mockNode('update_expression', 'i++', [mockNode('identifier', 'i')])
    const body = mockNode('compound_statement', '{}', [])
    const node = mockNode('for_statement', 'for (int i = 1; i <= 10; i++) {}', [init, cond, update, body], {
      initializer: init, condition: cond, update: update, body: body,
    })
    const result = lifter.lift(node)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('count_loop')
    expect(result!.properties.inclusive).toBe('TRUE')
  })

  it('should detect exclusive count_loop (<)', () => {
    const init = mockNode('declaration', 'int i = 0', [
      mockNode('primitive_type', 'int'),
      mockNode('init_declarator', 'i = 0', [
        mockNode('identifier', 'i'),
        unnamed('=', '='),
        mockNode('number_literal', '0'),
      ], { declarator: mockNode('identifier', 'i'), value: mockNode('number_literal', '0') }),
    ])
    const cond = mockNode('binary_expression', 'i < 10', [
      mockNode('identifier', 'i'),
      unnamed('<', '<'),
      mockNode('number_literal', '10'),
    ], { left: mockNode('identifier', 'i'), right: mockNode('number_literal', '10') })
    const update = mockNode('update_expression', 'i++', [mockNode('identifier', 'i')])
    const body = mockNode('compound_statement', '{}', [])
    const node = mockNode('for_statement', 'for (int i = 0; i < 10; i++) {}', [init, cond, update, body], {
      initializer: init, condition: cond, update: update, body: body,
    })
    const result = lifter.lift(node)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('count_loop')
    expect(result!.properties.inclusive).toBe('FALSE')
  })

  it('should detect count_loop with i += 1 update', () => {
    const init = mockNode('declaration', 'int i', [
      mockNode('primitive_type', 'int'),
      mockNode('identifier', 'i'),
    ])
    const cond = mockNode('binary_expression', 'i < 10', [
      mockNode('identifier', 'i'),
      unnamed('<', '<'),
      mockNode('number_literal', '10'),
    ], { left: mockNode('identifier', 'i'), right: mockNode('number_literal', '10') })
    const update = mockNode('assignment_expression', 'i += 1', [
      mockNode('identifier', 'i'),
      unnamed('+=', '+='),
      mockNode('number_literal', '1'),
    ], { left: mockNode('identifier', 'i'), right: mockNode('number_literal', '1') })
    const body = mockNode('compound_statement', '{}', [])
    const node = mockNode('for_statement', 'for (int i; i < 10; i += 1) {}', [init, cond, update, body], {
      initializer: init, condition: cond, update: update, body: body,
    })
    const result = lifter.lift(node)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('count_loop')
    expect(result!.properties.var_name).toBe('i')
    expect(result!.properties.inclusive).toBe('FALSE')
    // No initializer value → empty from
    expect(result!.children.from).toHaveLength(0)
  })

  it('should NOT treat i += 2 as counting for', () => {
    const init = mockNode('declaration', 'int i = 0', [
      mockNode('primitive_type', 'int'),
      mockNode('init_declarator', 'i = 0', [
        mockNode('identifier', 'i'),
        mockNode('number_literal', '0'),
      ], { declarator: mockNode('identifier', 'i'), value: mockNode('number_literal', '0') }),
    ])
    const cond = mockNode('binary_expression', 'i < 10', [
      mockNode('identifier', 'i'),
      unnamed('<', '<'),
      mockNode('number_literal', '10'),
    ], { left: mockNode('identifier', 'i'), right: mockNode('number_literal', '10') })
    const update = mockNode('assignment_expression', 'i += 2', [
      mockNode('identifier', 'i'),
      unnamed('+=', '+='),
      mockNode('number_literal', '2'),
    ], { left: mockNode('identifier', 'i'), right: mockNode('number_literal', '2') })
    const body = mockNode('compound_statement', '{}', [])
    const node = mockNode('for_statement', 'for (int i = 0; i < 10; i += 2) {}', [init, cond, update, body], {
      initializer: init, condition: cond, update: update, body: body,
    })
    const result = lifter.lift(node)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('cpp_for_loop')
  })

  it('should lift non-counting for to cpp_for_loop', () => {
    const init = mockNode('expression_statement', 'x = 0;', [mockNode('assignment_expression', 'x = 0')])
    const cond = mockNode('binary_expression', 'x < 10', [], {
      left: mockNode('identifier', 'x'),
      right: mockNode('number_literal', '10'),
    })
    const update = mockNode('assignment_expression', 'x = x + 1')
    const body = mockNode('compound_statement', '{}', [])
    const node = mockNode('for_statement', 'for (x = 0; x < 10; x = x + 1) {}', [init, cond, update, body], {
      initializer: init,
      condition: cond,
      update: update,
      body: body,
    })
    const result = lifter.lift(node)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('cpp_for_loop')
    expect(result!.children.init).toBeDefined()
    expect(result!.children.cond).toBeDefined()
    expect(result!.children.update).toBeDefined()
  })

  it('should reject mismatched variable in counting for (cond uses different var)', () => {
    // for (int j = 1; i <= 9; j++) — condition uses i, not j
    const init = mockNode('declaration', 'int j = 1', [
      mockNode('primitive_type', 'int'),
      mockNode('init_declarator', 'j = 1', [
        mockNode('identifier', 'j'),
        unnamed('=', '='),
        mockNode('number_literal', '1'),
      ], { declarator: mockNode('identifier', 'j'), value: mockNode('number_literal', '1') }),
    ])
    const cond = mockNode('binary_expression', 'i <= 9', [
      mockNode('identifier', 'i'),
      unnamed('<=', '<='),
      mockNode('number_literal', '9'),
    ], { left: mockNode('identifier', 'i'), right: mockNode('number_literal', '9') })
    const update = mockNode('update_expression', 'j++', [mockNode('identifier', 'j')])
    const body = mockNode('compound_statement', '{}', [])
    const node = mockNode('for_statement', 'for (int j = 1; i <= 9; j++) {}', [init, cond, update, body], {
      initializer: init, condition: cond, update: update, body: body,
    })
    const result = lifter.lift(node)
    expect(result).not.toBeNull()
    // Should NOT be count_loop — variable mismatch
    expect(result!.concept).toBe('cpp_for_loop')
  })

  it('should reject mismatched variable in counting for (update uses different var)', () => {
    // for (int i = 1; i <= 9; j++) — update uses j, not i
    const init = mockNode('declaration', 'int i = 1', [
      mockNode('primitive_type', 'int'),
      mockNode('init_declarator', 'i = 1', [
        mockNode('identifier', 'i'),
        unnamed('=', '='),
        mockNode('number_literal', '1'),
      ], { declarator: mockNode('identifier', 'i'), value: mockNode('number_literal', '1') }),
    ])
    const cond = mockNode('binary_expression', 'i <= 9', [
      mockNode('identifier', 'i'),
      unnamed('<=', '<='),
      mockNode('number_literal', '9'),
    ], { left: mockNode('identifier', 'i'), right: mockNode('number_literal', '9') })
    const update = mockNode('update_expression', 'j++', [mockNode('identifier', 'j')])
    const body = mockNode('compound_statement', '{}', [])
    const node = mockNode('for_statement', 'for (int i = 1; i <= 9; j++) {}', [init, cond, update, body], {
      initializer: init, condition: cond, update: update, body: body,
    })
    const result = lifter.lift(node)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('cpp_for_loop')
  })

  it('should lift for(int i = 1;;) with no condition/update to cpp_for_loop', () => {
    const initDecl = mockNode('init_declarator', 'i = 1', [
      mockNode('identifier', 'i'),
      mockNode('number_literal', '1'),
    ], { declarator: mockNode('identifier', 'i'), value: mockNode('number_literal', '1') })
    const init = mockNode('declaration', 'int i = 1', [
      mockNode('primitive_type', 'int'),
      initDecl,
    ])
    const body = mockNode('compound_statement', '{}', [])
    const node = mockNode('for_statement', 'for (int i = 1;;) {}', [init, body], {
      initializer: init, condition: null, update: null, body: body,
    })
    const result = lifter.lift(node)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('cpp_for_loop')
    // init should be wrapped as cpp_raw_expression since declaration is a statement
    expect(result!.children.init).toHaveLength(1)
    expect(result!.children.init[0].concept).toBe('cpp_raw_expression')
    expect(result!.children.init[0].properties.code).toBe('int i = 1')
    // No condition or update
    expect(result!.children.cond).toHaveLength(0)
    expect(result!.children.update).toHaveLength(0)
  })

  it('should wrap statement-concept update (i += 2) as cpp_raw_expression in cpp_for_loop', () => {
    const initDecl = mockNode('init_declarator', 'i = 0', [
      mockNode('identifier', 'i'),
      mockNode('number_literal', '0'),
    ], { declarator: mockNode('identifier', 'i'), value: mockNode('number_literal', '0') })
    const init = mockNode('declaration', 'int i = 0', [
      mockNode('primitive_type', 'int'),
      initDecl,
    ])
    const cond = mockNode('binary_expression', 'i < 10', [
      mockNode('identifier', 'i'),
      unnamed('<', '<'),
      mockNode('number_literal', '10'),
    ], { left: mockNode('identifier', 'i'), right: mockNode('number_literal', '10') })
    // i += 2 is assignment_expression, lifts to cpp_compound_assign (statement)
    const update = mockNode('assignment_expression', 'i += 2', [
      mockNode('identifier', 'i'),
      unnamed('+=', '+='),
      mockNode('number_literal', '2'),
    ], { left: mockNode('identifier', 'i'), right: mockNode('number_literal', '2') })
    const body = mockNode('compound_statement', '{}', [])
    const node = mockNode('for_statement', 'for (int i = 0; i < 10; i += 2) {}', [init, cond, update, body], {
      initializer: init, condition: cond, update: update, body: body,
    })
    const result = lifter.lift(node)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('cpp_for_loop')
    // init (declaration) → cpp_raw_expression
    expect(result!.children.init[0].concept).toBe('cpp_raw_expression')
    expect(result!.children.init[0].properties.code).toBe('int i = 0')
    // cond present
    expect(result!.children.cond).toHaveLength(1)
    // update (assignment_expression → unresolved) → cpp_raw_expression
    expect(result!.children.update[0].concept).toBe('cpp_raw_expression')
    expect(result!.children.update[0].properties.code).toBe('i += 2')
  })

  it('should lift function_definition', () => {
    const typeNode = mockNode('primitive_type', 'int')
    const paramDecl = mockNode('parameter_declaration', 'int a')
    const paramList = mockNode('parameter_list', '(int a)', [paramDecl])
    const nameNode = mockNode('identifier', 'add')
    const declarator = mockNode('function_declarator', 'add(int a)', [nameNode, paramList], {
      declarator: nameNode,
      parameters: paramList,
    })
    const body = mockNode('compound_statement', '{ return 0; }', [
      mockNode('return_statement', 'return 0;', [
        unnamed('return', 'return'),
        mockNode('number_literal', '0'),
        unnamed(';', ';'),
      ]),
    ])
    const node = mockNode('function_definition', 'int add(int a) { return 0; }', [typeNode, declarator, body], {
      type: typeNode,
      declarator: declarator,
      body: body,
    })
    const result = lifter.lift(node)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('func_def')
    expect(result!.properties.name).toBe('add')
    expect(result!.properties.return_type).toBe('int')
    expect(result!.properties.params).toContain('int a')
    expect(result!.children.body).toHaveLength(1)
  })

  it('should lift compound_statement as _compound pseudo-node', () => {
    const node = mockNode('compound_statement', '{ break; }', [
      mockNode('break_statement', 'break;'),
    ])
    const result = lifter.lift(node)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('_compound')
    expect(result!.children.body).toHaveLength(1)
  })

  it('should lift condition_clause by unwrapping', () => {
    const inner = mockNode('identifier', 'flag')
    const node = mockNode('condition_clause', '(flag)', [inner])
    const result = lifter.lift(node)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('var_ref')
    expect(result!.properties.name).toBe('flag')
  })
})

describe('C++ I/O Lifters', () => {
  it('should lift printf call to print', () => {
    const fmt = mockNode('string_literal', '"%d"')
    const arg = mockNode('identifier', 'x')
    const argsNode = mockNode('argument_list', '("%d", x)', [fmt, arg])
    const funcNode = mockNode('identifier', 'printf')
    const node = mockNode('call_expression', 'printf("%d", x)', [funcNode, argsNode], {
      function: funcNode,
      arguments: argsNode,
    })
    const result = lifter.lift(node)
    expect(result).not.toBeNull()
    expect(['print', 'cpp_printf']).toContain(result!.concept)
    expect(result!.children.values).toHaveLength(1)
    expect(result!.children.values[0].concept).toBe('var_ref')
  })

  it('should lift scanf call to input', () => {
    const fmt = mockNode('string_literal', '"%d"')
    const varArg = mockNode('unary_expression', '&x', [
      unnamed('&', '&'),
      mockNode('identifier', 'x'),
    ], { argument: mockNode('identifier', 'x') })
    const argsNode = mockNode('argument_list', '("%d", &x)', [fmt, varArg])
    const funcNode = mockNode('identifier', 'scanf')
    const node = mockNode('call_expression', 'scanf("%d", &x)', [funcNode, argsNode], {
      function: funcNode,
      arguments: argsNode,
    })
    const result = lifter.lift(node)
    expect(result).not.toBeNull()
    expect(['input', 'cpp_scanf']).toContain(result!.concept)
    // Modern format uses values children with var_ref nodes
    const values = result!.children.values ?? []
    expect(values.length).toBe(1)
    expect(values[0].concept).toBe('var_ref')
    expect(values[0].properties.name).toBe('x')
  })

  it('should lift generic function call to func_call_expr', () => {
    const arg = mockNode('number_literal', '5')
    const argsNode = mockNode('argument_list', '(5)', [arg])
    const funcNode = mockNode('identifier', 'myFunc')
    const node = mockNode('call_expression', 'myFunc(5)', [funcNode, argsNode], {
      function: funcNode,
      arguments: argsNode,
    })
    const result = lifter.lift(node)
    expect(result).not.toBeNull()
    expect(result!.concept).toBe('func_call_expr')
    expect(result!.properties.name).toBe('myFunc')
    expect(result!.children.args).toHaveLength(1)
  })
})
