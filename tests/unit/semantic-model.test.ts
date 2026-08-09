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
    const node = createNode('cpp:var_declare')
    expect(node.conceptId).toBe('cpp:var_declare')
    expect(node.properties).toEqual({})
    expect(node.children).toEqual({})
    expect(node.id).toBeDefined()
  })

  it('should create a node with all arguments', () => {
    const child = createNode('cpp:literal_number', { value: '5' })
    const node = createNode(
      'cpp:var_declare',
      { name: 'x', type: 'int' },
      { initializer: [child] },
    )
    expect(node.conceptId).toBe('cpp:var_declare')
    expect(node.properties).toEqual({ name: 'x', type: 'int' })
    expect(node.children.initializer[0]).toBe(child)
  })

  it('should create language-specific concept nodes', () => {
    const node = createNode('cpp:include', { header: 'iostream' })
    expect(node.conceptId).toBe('cpp:include')
    expect(node.properties.header).toBe('iostream')
  })

  it('should generate unique ids', () => {
    const a = createNode('cpp:var_declare')
    const b = createNode('cpp:var_declare')
    expect(a.id).not.toBe(b.id)
  })
})

describe('nodeEquals', () => {
  it('should return true for identical simple nodes', () => {
    const a = createNode('cpp:literal_number', { value: '42' })
    const b = createNode('cpp:literal_number', { value: '42' })
    expect(nodeEquals(a, b)).toBe(true)
  })

  it('should return false for different concepts', () => {
    const a = createNode('cpp:literal_number', { value: '42' })
    const b = createNode('cpp:literal_string', { value: '42' })
    expect(nodeEquals(a, b)).toBe(false)
  })

  it('should return false for different properties', () => {
    const a = createNode('cpp:var_declare', { name: 'x', type: 'int' })
    const b = createNode('cpp:var_declare', { name: 'y', type: 'int' })
    expect(nodeEquals(a, b)).toBe(false)
  })

  it('should ignore metadata and id in comparison', () => {
    const a = createNode('cpp:literal_number', { value: '5' })
    const b = createNode('cpp:literal_number', { value: '5' })
    a.metadata = { rawCode: 'a' }
    b.metadata = { rawCode: 'b' }
    expect(nodeEquals(a, b)).toBe(true)
  })

  it('should compare nested children recursively', () => {
    const childA = createNode('cpp:literal_number', { value: '5' })
    const childB = createNode('cpp:literal_number', { value: '5' })
    const a = createNode('cpp:var_declare', { name: 'x' }, { initializer: [childA] })
    const b = createNode('cpp:var_declare', { name: 'x' }, { initializer: [childB] })
    expect(nodeEquals(a, b)).toBe(true)
  })

  it('should return false for different nested children', () => {
    const childA = createNode('cpp:literal_number', { value: '5' })
    const childB = createNode('cpp:literal_number', { value: '10' })
    const a = createNode('cpp:var_declare', { name: 'x' }, { initializer: [childA] })
    const b = createNode('cpp:var_declare', { name: 'x' }, { initializer: [childB] })
    expect(nodeEquals(a, b)).toBe(false)
  })

  it('should compare array children', () => {
    const stmt1 = createNode('cpp:var_declare', { name: 'x' })
    const stmt2 = createNode('cpp:var_declare', { name: 'y' })
    const a = createNode('cpp:program', {}, { body: [stmt1, stmt2] })
    const b = createNode('cpp:program', {}, { body: [stmt1, stmt2] })
    expect(nodeEquals(a, b)).toBe(true)
  })

  it('should return false for different array children lengths', () => {
    const stmt1 = createNode('cpp:var_declare', { name: 'x' })
    const a = createNode('cpp:program', {}, { body: [stmt1] })
    const b = createNode('cpp:program', {}, { body: [stmt1, stmt1] })
    expect(nodeEquals(a, b)).toBe(false)
  })

  it('should return false for different number of children keys', () => {
    const child = createNode('cpp:literal_number', { value: '1' })
    const a = createNode('cpp:if', {}, { condition: [child] })
    const b = createNode('cpp:if', {}, { condition: [child], then_body: [child] })
    expect(nodeEquals(a, b)).toBe(false)
  })
})

describe('semanticEquals', () => {
  it('should compare two SemanticModels ignoring metadata', () => {
    const prog1: SemanticModel = {
      program: createNode('cpp:program', {}, {
        body: [createNode('cpp:var_declare', { name: 'x', type: 'int' })],
      }),
      metadata: { lineCount: 5 },
    }
    const prog2: SemanticModel = {
      program: createNode('cpp:program', {}, {
        body: [createNode('cpp:var_declare', { name: 'x', type: 'int' })],
      }),
      metadata: { lineCount: 10 },
    }
    expect(semanticEquals(prog1, prog2)).toBe(true)
  })

  it('should return false for semantically different models', () => {
    const prog1: SemanticModel = {
      program: createNode('cpp:program', {}, {
        body: [createNode('cpp:var_declare', { name: 'x', type: 'int' })],
      }),
      metadata: {},
    }
    const prog2: SemanticModel = {
      program: createNode('cpp:program', {}, {
        body: [createNode('cpp:var_declare', { name: 'y', type: 'double' })],
      }),
      metadata: {},
    }
    expect(semanticEquals(prog1, prog2)).toBe(false)
  })
})

describe('walkNodes', () => {
  it('should visit all nodes in the tree', () => {
    const child1 = createNode('cpp:literal_number', { value: '5' })
    const child2 = createNode('cpp:literal_string', { value: 'hello' })
    const root = createNode('cpp:program', {}, { body: [child1, child2] })

    const visited: string[] = []
    walkNodes(root, (node) => visited.push(node.conceptId))

    expect(visited).toEqual(['cpp:program', 'cpp:literal_number', 'cpp:literal_string'])
  })

  it('should walk deeply nested trees', () => {
    const value = createNode('cpp:literal_number', { value: '10' })
    const decl = createNode('cpp:var_declare', { name: 'x' }, { initializer: [value] })
    const func = createNode('cpp:func_def', { name: 'main' }, { body: [decl] })
    const root = createNode('cpp:program', {}, { body: [func] })

    const visited: string[] = []
    walkNodes(root, (node) => visited.push(node.conceptId))

    expect(visited).toEqual(['cpp:program', 'cpp:func_def', 'cpp:var_declare', 'cpp:literal_number'])
  })

  it('should handle empty children', () => {
    const root = createNode('cpp:break')
    const visited: string[] = []
    walkNodes(root, (node) => visited.push(node.conceptId))
    expect(visited).toEqual(['cpp:break'])
  })
})

describe('serializeModel / deserializeModel', () => {
  it('should round-trip a SemanticModel through JSON', () => {
    const model: SemanticModel = {
      program: createNode('cpp:program', {}, {
        body: [
          createNode('cpp:var_declare', { name: 'x', type: 'int' }, {
            initializer: [createNode('cpp:literal_number', { value: '42' })],
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
      program: createNode('cpp:program', {}, { body: [] }),
      metadata: {},
    }

    const json = serializeModel(model)
    const restored = deserializeModel(json)

    expect(semanticEquals(model, restored)).toBe(true)
  })
})
