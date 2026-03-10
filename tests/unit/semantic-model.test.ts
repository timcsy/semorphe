import { describe, it, expect } from 'vitest'
import {
  createNode,
  nodeEquals,
  semanticEquals,
  walkNodes,
  serializeModel,
  deserializeModel,
} from '../../src/core/semantic-tree'
import type { SemanticNode, SemanticModel } from '../../src/core/types'

describe('createNode', () => {
  it('should create a node with minimal arguments', () => {
    const node = createNode('var_declare')
    expect(node.concept).toBe('var_declare')
    expect(node.properties).toEqual({})
    expect(node.children).toEqual({})
    expect(node.id).toBeDefined()
  })

  it('should create a node with all arguments', () => {
    const child = createNode('number_literal', { value: '5' })
    const node = createNode(
      'var_declare',
      { name: 'x', type: 'int' },
      { initializer: [child] },
    )
    expect(node.concept).toBe('var_declare')
    expect(node.properties).toEqual({ name: 'x', type: 'int' })
    expect(node.children.initializer[0]).toBe(child)
  })

  it('should create language-specific concept nodes', () => {
    const node = createNode('cpp:include', { header: 'iostream' })
    expect(node.concept).toBe('cpp:include')
    expect(node.properties.header).toBe('iostream')
  })

  it('should generate unique ids', () => {
    const a = createNode('var_declare')
    const b = createNode('var_declare')
    expect(a.id).not.toBe(b.id)
  })
})

describe('nodeEquals', () => {
  it('should return true for identical simple nodes', () => {
    const a = createNode('number_literal', { value: '42' })
    const b = createNode('number_literal', { value: '42' })
    expect(nodeEquals(a, b)).toBe(true)
  })

  it('should return false for different concepts', () => {
    const a = createNode('number_literal', { value: '42' })
    const b = createNode('string_literal', { value: '42' })
    expect(nodeEquals(a, b)).toBe(false)
  })

  it('should return false for different properties', () => {
    const a = createNode('var_declare', { name: 'x', type: 'int' })
    const b = createNode('var_declare', { name: 'y', type: 'int' })
    expect(nodeEquals(a, b)).toBe(false)
  })

  it('should ignore metadata and id in comparison', () => {
    const a = createNode('number_literal', { value: '5' })
    const b = createNode('number_literal', { value: '5' })
    a.metadata = { rawCode: 'a' }
    b.metadata = { rawCode: 'b' }
    expect(nodeEquals(a, b)).toBe(true)
  })

  it('should compare nested children recursively', () => {
    const childA = createNode('number_literal', { value: '5' })
    const childB = createNode('number_literal', { value: '5' })
    const a = createNode('var_declare', { name: 'x' }, { initializer: [childA] })
    const b = createNode('var_declare', { name: 'x' }, { initializer: [childB] })
    expect(nodeEquals(a, b)).toBe(true)
  })

  it('should return false for different nested children', () => {
    const childA = createNode('number_literal', { value: '5' })
    const childB = createNode('number_literal', { value: '10' })
    const a = createNode('var_declare', { name: 'x' }, { initializer: [childA] })
    const b = createNode('var_declare', { name: 'x' }, { initializer: [childB] })
    expect(nodeEquals(a, b)).toBe(false)
  })

  it('should compare array children', () => {
    const stmt1 = createNode('var_declare', { name: 'x' })
    const stmt2 = createNode('var_declare', { name: 'y' })
    const a = createNode('program', {}, { body: [stmt1, stmt2] })
    const b = createNode('program', {}, { body: [stmt1, stmt2] })
    expect(nodeEquals(a, b)).toBe(true)
  })

  it('should return false for different array children lengths', () => {
    const stmt1 = createNode('var_declare', { name: 'x' })
    const a = createNode('program', {}, { body: [stmt1] })
    const b = createNode('program', {}, { body: [stmt1, stmt1] })
    expect(nodeEquals(a, b)).toBe(false)
  })

  it('should return false for different number of children keys', () => {
    const child = createNode('number_literal', { value: '1' })
    const a = createNode('if', {}, { condition: [child] })
    const b = createNode('if', {}, { condition: [child], then_body: [child] })
    expect(nodeEquals(a, b)).toBe(false)
  })
})

describe('semanticEquals', () => {
  it('should compare two SemanticModels ignoring metadata', () => {
    const prog1: SemanticModel = {
      program: createNode('program', {}, {
        body: [createNode('var_declare', { name: 'x', type: 'int' })],
      }),
      metadata: { lineCount: 5 },
    }
    const prog2: SemanticModel = {
      program: createNode('program', {}, {
        body: [createNode('var_declare', { name: 'x', type: 'int' })],
      }),
      metadata: { lineCount: 10 },
    }
    expect(semanticEquals(prog1, prog2)).toBe(true)
  })

  it('should return false for semantically different models', () => {
    const prog1: SemanticModel = {
      program: createNode('program', {}, {
        body: [createNode('var_declare', { name: 'x', type: 'int' })],
      }),
      metadata: {},
    }
    const prog2: SemanticModel = {
      program: createNode('program', {}, {
        body: [createNode('var_declare', { name: 'y', type: 'double' })],
      }),
      metadata: {},
    }
    expect(semanticEquals(prog1, prog2)).toBe(false)
  })
})

describe('walkNodes', () => {
  it('should visit all nodes in the tree', () => {
    const child1 = createNode('number_literal', { value: '5' })
    const child2 = createNode('string_literal', { value: 'hello' })
    const root = createNode('program', {}, { body: [child1, child2] })

    const visited: string[] = []
    walkNodes(root, (node) => visited.push(node.concept))

    expect(visited).toEqual(['program', 'number_literal', 'string_literal'])
  })

  it('should walk deeply nested trees', () => {
    const value = createNode('number_literal', { value: '10' })
    const decl = createNode('var_declare', { name: 'x' }, { initializer: [value] })
    const func = createNode('func_def', { name: 'main' }, { body: [decl] })
    const root = createNode('program', {}, { body: [func] })

    const visited: string[] = []
    walkNodes(root, (node) => visited.push(node.concept))

    expect(visited).toEqual(['program', 'func_def', 'var_declare', 'number_literal'])
  })

  it('should handle empty children', () => {
    const root = createNode('break')
    const visited: string[] = []
    walkNodes(root, (node) => visited.push(node.concept))
    expect(visited).toEqual(['break'])
  })
})

describe('serializeModel / deserializeModel', () => {
  it('should round-trip a SemanticModel through JSON', () => {
    const model: SemanticModel = {
      program: createNode('program', {}, {
        body: [
          createNode('var_declare', { name: 'x', type: 'int' }, {
            initializer: [createNode('number_literal', { value: '42' })],
          }),
        ],
      }),
      metadata: { lineCount: 3 },
    }

    const json = serializeModel(model)
    const restored = deserializeModel(json)

    expect(semanticEquals(model, restored)).toBe(true)
    expect(restored.metadata.lineCount).toBe(3)
  })

  it('should handle empty program', () => {
    const model: SemanticModel = {
      program: createNode('program', {}, { body: [] }),
      metadata: {},
    }

    const json = serializeModel(model)
    const restored = deserializeModel(json)

    expect(semanticEquals(model, restored)).toBe(true)
  })
})
