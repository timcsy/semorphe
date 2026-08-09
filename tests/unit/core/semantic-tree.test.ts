import { describe, it, expect } from 'vitest'
import {
  createEmptyProgram,
  createNode,
  addChild,
  removeChild,
  updateProperty,
  findById,
  serializeTree,
  deserializeTree,
} from '../../../src/core/semantic-tree'
import type { SemanticNode } from '../../../src/core/types'

describe('SemanticTree', () => {
  describe('createEmptyProgram', () => {
    it('should create a program node with empty body', () => {
      const tree = createEmptyProgram()
      expect(tree.conceptId).toBe('cpp:program')
      expect(tree.children.body).toEqual([])
      expect(tree.id).toBeTruthy()
    })
  })

  describe('createNode', () => {
    it('should create a node with given concept and properties', () => {
      const node = createNode('cpp:var_declare', { name: 'x', type: 'int' })
      expect(node.conceptId).toBe('cpp:var_declare')
      expect(node.properties.name).toBe('x')
      expect(node.properties.type).toBe('int')
      expect(node.id).toBeTruthy()
    })

    it('should create a node with children', () => {
      const value = createNode('cpp:literal_number', { value: '5' })
      const node = createNode('cpp:var_declare', { name: 'x' }, { initializer: [value] })
      expect(node.children.initializer).toHaveLength(1)
      expect(node.children.initializer[0].conceptId).toBe('cpp:literal_number')
    })
  })

  describe('addChild', () => {
    it('should return a new tree with the child added', () => {
      const tree = createEmptyProgram()
      const child = createNode('cpp:var_declare', { name: 'x' })
      const newTree = addChild(tree, tree.id, 'body', child)
      expect(newTree.children.body).toHaveLength(1)
      expect(newTree.children.body[0].conceptId).toBe('cpp:var_declare')
      // original tree is unchanged (immutable)
      expect(tree.children.body).toHaveLength(0)
    })

    it('should append to existing children', () => {
      const tree = createEmptyProgram()
      const child1 = createNode('cpp:var_declare', { name: 'x' })
      const child2 = createNode('cpp:var_declare', { name: 'y' })
      const t1 = addChild(tree, tree.id, 'body', child1)
      const t2 = addChild(t1, t1.id, 'body', child2)
      expect(t2.children.body).toHaveLength(2)
    })
  })

  describe('removeChild', () => {
    it('should return a new tree with the child removed', () => {
      const tree = createEmptyProgram()
      const child = createNode('cpp:var_declare', { name: 'x' })
      const withChild = addChild(tree, tree.id, 'body', child)
      const removed = removeChild(withChild, withChild.id, 'body', 0)
      expect(removed.children.body).toHaveLength(0)
      // original unchanged
      expect(withChild.children.body).toHaveLength(1)
    })
  })

  describe('updateProperty', () => {
    it('should return a new tree with updated property', () => {
      const node = createNode('cpp:var_declare', { name: 'x', type: 'int' })
      const tree: SemanticNode = {
        ...createEmptyProgram(),
        children: { body: [node] },
      }
      const updated = updateProperty(tree, node.id, 'name', 'y')
      const updatedChild = findById(updated, node.id)
      expect(updatedChild?.properties.name).toBe('y')
      // original unchanged
      const originalChild = findById(tree, node.id)
      expect(originalChild?.properties.name).toBe('x')
    })
  })

  describe('findById', () => {
    it('should find a node by id in a nested tree', () => {
      const inner = createNode('cpp:literal_number', { value: '5' })
      const outer = createNode('cpp:var_declare', { name: 'x' }, { initializer: [inner] })
      const tree: SemanticNode = {
        ...createEmptyProgram(),
        children: { body: [outer] },
      }
      const found = findById(tree, inner.id)
      expect(found).toBeTruthy()
      expect(found?.conceptId).toBe('cpp:literal_number')
    })

    it('should return null for non-existent id', () => {
      const tree = createEmptyProgram()
      expect(findById(tree, 'nonexistent')).toBeNull()
    })
  })

  describe('serialization', () => {
    it('should round-trip through JSON', () => {
      const value = createNode('cpp:literal_number', { value: '5' })
      const decl = createNode('cpp:var_declare', { name: 'x', type: 'int' }, { initializer: [value] })
      const tree = addChild(createEmptyProgram(), createEmptyProgram().id, 'body', decl)
      // Need to use the actual tree's id
      const program = createEmptyProgram()
      const withDecl = addChild(program, program.id, 'body', decl)

      const json = serializeTree(withDecl)
      const restored = deserializeTree(json)
      expect(restored.conceptId).toBe('cpp:program')
      expect(restored.children.body).toHaveLength(1)
      expect(restored.children.body[0].conceptId).toBe('cpp:var_declare')
      expect(restored.children.body[0].properties.name).toBe('x')
    })

    it('should preserve annotations and metadata', () => {
      const node = createNode('cpp:var_declare', { name: 'x' })
      node.annotations = [{ type: 'comment', text: 'set x', position: 'inline' }]
      node.metadata = { syntaxPreference: 'compound_assign', confidence: 'high' }
      const json = serializeTree(node)
      const restored = deserializeTree(json)
      expect(restored.annotations).toHaveLength(1)
      expect(restored.annotations![0].text).toBe('set x')
      expect(restored.metadata?.confidence).toBe('high')
    })
  })
})
