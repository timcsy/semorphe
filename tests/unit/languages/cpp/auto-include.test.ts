import { describe, it, expect } from 'vitest'
import { computeAutoIncludes } from '../../../../src/languages/cpp/auto-include'
import { createPopulatedRegistry } from '../../../../src/languages/cpp/std'
import { createNode } from '../../../../src/core/semantic-tree'

const registry = createPopulatedRegistry()

function makeProgram(body: ReturnType<typeof createNode>[]) {
  return createNode('program', {}, { body })
}

/** Extract header strings from DependencyEdge[] for backward-compatible assertions */
function headers(edges: ReturnType<typeof computeAutoIncludes>): string[] {
  return edges.map(e => e.header)
}

describe('Auto-include engine', () => {
  describe('computeAutoIncludes', () => {
    it('should return <iostream> for print concept', () => {
      const tree = makeProgram([
        createNode('func_def', { name: 'main', return_type: 'int', params: [] }, {
          body: [
            createNode('print', {}, { values: [createNode('var_ref', { name: 'x' })] }),
          ],
        }),
      ])
      const edges = computeAutoIncludes(tree, registry)
      expect(headers(edges)).toContain('<iostream>')
    })

    it('should return <cstdio> for cpp_printf concept', () => {
      const tree = makeProgram([
        createNode('func_def', { name: 'main', return_type: 'int', params: [] }, {
          body: [
            createNode('cpp_printf', { format: '%d\\n' }, { args: [createNode('var_ref', { name: 'x' })] }),
          ],
        }),
      ])
      const edges = computeAutoIncludes(tree, registry)
      expect(headers(edges)).toContain('<cstdio>')
    })

    it('should return <vector> for cpp_vector_declare concept', () => {
      const tree = makeProgram([
        createNode('cpp_vector_declare', { type: 'int', name: 'v' }),
      ])
      const edges = computeAutoIncludes(tree, registry)
      expect(headers(edges)).toContain('<vector>')
    })

    it('should return multiple headers for mixed concepts', () => {
      const tree = makeProgram([
        createNode('func_def', { name: 'main', return_type: 'int', params: [] }, {
          body: [
            createNode('print', {}, { values: [createNode('var_ref', { name: 'x' })] }),
            createNode('cpp_vector_declare', { type: 'int', name: 'v' }),
          ],
        }),
      ])
      const edges = computeAutoIncludes(tree, registry)
      expect(headers(edges)).toContain('<iostream>')
      expect(headers(edges)).toContain('<vector>')
    })

    it('should deduplicate headers (multiple print nodes)', () => {
      const tree = makeProgram([
        createNode('print', {}, { values: [createNode('var_ref', { name: 'x' })] }),
        createNode('print', {}, { values: [createNode('var_ref', { name: 'y' })] }),
        createNode('input', {}, { values: [createNode('var_ref', { name: 'z' })] }),
      ])
      const edges = computeAutoIncludes(tree, registry)
      const iostreamCount = headers(edges).filter(h => h === '<iostream>').length
      expect(iostreamCount).toBe(1)
    })

    it('should exclude manually included headers', () => {
      const tree = makeProgram([
        createNode('cpp_include', { header: 'iostream', local: false }),
        createNode('func_def', { name: 'main', return_type: 'int', params: [] }, {
          body: [
            createNode('print', {}, { values: [createNode('var_ref', { name: 'x' })] }),
          ],
        }),
      ])
      const edges = computeAutoIncludes(tree, registry)
      expect(headers(edges)).not.toContain('<iostream>')
    })

    it('should return empty for core-only concepts (no #include needed)', () => {
      const tree = makeProgram([
        createNode('var_declare', { name: 'x', type: 'int' }),
        createNode('if', {}, {
          condition: [createNode('compare', { operator: '==' }, {
            left: [createNode('var_ref', { name: 'x' })],
            right: [createNode('number_literal', { value: '0' })],
          })],
          then_body: [],
        }),
      ])
      const edges = computeAutoIncludes(tree, registry)
      expect(edges).toHaveLength(0)
    })

    it('should exclude C-style equivalent of auto-included headers (stdio.h ≡ cstdio)', () => {
      const tree = makeProgram([
        createNode('cpp_include', { header: 'stdio.h', local: false }),
        createNode('cpp_printf', { format: '%d\\n' }, { args: [createNode('var_ref', { name: 'x' })] }),
      ])
      const edges = computeAutoIncludes(tree, registry)
      expect(headers(edges)).not.toContain('<cstdio>')
    })

    it('should exclude C-style equivalent of auto-included headers (string.h ≡ cstring)', () => {
      const tree = makeProgram([
        createNode('cpp_include', { header: 'string.h', local: false }),
        createNode('cpp_strlen', { name: 's' }),
      ])
      const edges = computeAutoIncludes(tree, registry)
      expect(headers(edges)).not.toContain('<cstring>')
    })

    it('should exclude C-style equivalent of auto-included headers (math.h ≡ cmath)', () => {
      const tree = makeProgram([
        createNode('cpp_include', { header: 'math.h', local: false }),
        createNode('cpp_math_func', { func: 'sqrt' }, { args: [createNode('number_literal', { value: '4' })] }),
      ])
      const edges = computeAutoIncludes(tree, registry)
      expect(headers(edges)).not.toContain('<cmath>')
    })

    it('should return sorted headers', () => {
      const tree = makeProgram([
        createNode('cpp_vector_declare', { type: 'int', name: 'v' }),
        createNode('print', {}, { values: [createNode('var_ref', { name: 'x' })] }),
      ])
      const edges = computeAutoIncludes(tree, registry)
      const h = headers(edges)
      const sorted = [...h].sort()
      expect(h).toEqual(sorted)
    })

    it('should return DependencyEdge objects with correct fields', () => {
      const tree = makeProgram([
        createNode('print', {}, { values: [createNode('var_ref', { name: 'x' })] }),
      ])
      const edges = computeAutoIncludes(tree, registry)
      expect(edges.length).toBeGreaterThan(0)
      const edge = edges.find(e => e.header === '<iostream>')!
      expect(edge).toBeDefined()
      expect(edge.directive).toBe('#include <iostream>')
      expect(edge.sourceType).toBe('stdlib')
      expect(edge.reason).toBeDefined()
    })
  })
})
