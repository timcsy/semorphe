import { describe, it, expect } from 'vitest'
import { computeAutoIncludes, autoIncludeNodes } from '../../../../src/languages/cpp/auto-include'
import { createPopulatedRegistry } from '../../../../src/languages/cpp/std'
import { createNode } from '../../../../src/core/semantic-tree'

const registry = createPopulatedRegistry()

function makeProgram(body: ReturnType<typeof createNode>[]) {
  return createNode('cpp:program', {}, { body })
}

/** Extract header strings from DependencyEdge[] for backward-compatible assertions */
function headers(edges: ReturnType<typeof computeAutoIncludes>): string[] {
  return edges.map(e => e.header)
}

describe('Auto-include engine', () => {
  describe('computeAutoIncludes', () => {
    it('should return <iostream> for print component', () => {
      const tree = makeProgram([
        createNode('cpp:func_def', { name: 'main', return_type: 'int', params: [] }, {
          body: [
            createNode('cpp:print', {}, { values: [createNode('cpp:var_ref', { name: 'x' })] }),
          ],
        }),
      ])
      const edges = computeAutoIncludes(tree, registry)
      expect(headers(edges)).toContain('<iostream>')
    })

    it('should return <cstdio> for cpp_printf component', () => {
      const tree = makeProgram([
        createNode('cpp:func_def', { name: 'main', return_type: 'int', params: [] }, {
          body: [
            createNode('cpp:print_formatted', { format: '%d\\n' }, { args: [createNode('cpp:var_ref', { name: 'x' })] }),
          ],
        }),
      ])
      const edges = computeAutoIncludes(tree, registry)
      expect(headers(edges)).toContain('<cstdio>')
    })

    it('should return <vector> for cpp_vector_declare component', () => {
      const tree = makeProgram([
        createNode('cpp:vector_declare', { type: 'int', name: 'v' }),
      ])
      const edges = computeAutoIncludes(tree, registry)
      expect(headers(edges)).toContain('<vector>')
    })

    it('should return multiple headers for mixed components', () => {
      const tree = makeProgram([
        createNode('cpp:func_def', { name: 'main', return_type: 'int', params: [] }, {
          body: [
            createNode('cpp:print', {}, { values: [createNode('cpp:var_ref', { name: 'x' })] }),
            createNode('cpp:vector_declare', { type: 'int', name: 'v' }),
          ],
        }),
      ])
      const edges = computeAutoIncludes(tree, registry)
      expect(headers(edges)).toContain('<iostream>')
      expect(headers(edges)).toContain('<vector>')
    })

    it('should deduplicate headers (multiple print nodes)', () => {
      const tree = makeProgram([
        createNode('cpp:print', {}, { values: [createNode('cpp:var_ref', { name: 'x' })] }),
        createNode('cpp:print', {}, { values: [createNode('cpp:var_ref', { name: 'y' })] }),
        createNode('cpp:input', {}, { values: [createNode('cpp:var_ref', { name: 'z' })] }),
      ])
      const edges = computeAutoIncludes(tree, registry)
      const iostreamCount = headers(edges).filter(h => h === '<iostream>').length
      expect(iostreamCount).toBe(1)
    })

    it('should exclude manually included headers', () => {
      const tree = makeProgram([
        createNode('cpp:include', { header: 'iostream', local: false }),
        createNode('cpp:func_def', { name: 'main', return_type: 'int', params: [] }, {
          body: [
            createNode('cpp:print', {}, { values: [createNode('cpp:var_ref', { name: 'x' })] }),
          ],
        }),
      ])
      const edges = computeAutoIncludes(tree, registry)
      expect(headers(edges)).not.toContain('<iostream>')
    })

    it('should return empty for core-only components (no #include needed)', () => {
      const tree = makeProgram([
        createNode('cpp:var_declare', { name: 'x', type: 'int' }),
        createNode('cpp:if', {}, {
          condition: [createNode('cpp:compare', { operator: '==' }, {
            left: [createNode('cpp:var_ref', { name: 'x' })],
            right: [createNode('cpp:literal_number', { value: '0' })],
          })],
          then_body: [],
        }),
      ])
      const edges = computeAutoIncludes(tree, registry)
      expect(edges).toHaveLength(0)
    })

    it('should exclude C-style equivalent of auto-included headers (stdio.h ≡ cstdio)', () => {
      const tree = makeProgram([
        createNode('cpp:include', { header: 'stdio.h', local: false }),
        createNode('cpp:print_formatted', { format: '%d\\n' }, { args: [createNode('cpp:var_ref', { name: 'x' })] }),
      ])
      const edges = computeAutoIncludes(tree, registry)
      expect(headers(edges)).not.toContain('<cstdio>')
    })

    it('should exclude C-style equivalent of auto-included headers (string.h ≡ cstring)', () => {
      const tree = makeProgram([
        createNode('cpp:include', { header: 'string.h', local: false }),
        createNode('cpp:cstring_size', { name: 's' }),
      ])
      const edges = computeAutoIncludes(tree, registry)
      expect(headers(edges)).not.toContain('<cstring>')
    })

    it('should exclude C-style equivalent of auto-included headers (math.h ≡ cmath)', () => {
      const tree = makeProgram([
        createNode('cpp:include', { header: 'math.h', local: false }),
        createNode('cpp_math_func', { func: 'sqrt' }, { args: [createNode('cpp:literal_number', { value: '4' })] }),
      ])
      const edges = computeAutoIncludes(tree, registry)
      expect(headers(edges)).not.toContain('<cmath>')
    })

    it('should return sorted headers', () => {
      const tree = makeProgram([
        createNode('cpp:vector_declare', { type: 'int', name: 'v' }),
        createNode('cpp:print', {}, { values: [createNode('cpp:var_ref', { name: 'x' })] }),
      ])
      const edges = computeAutoIncludes(tree, registry)
      const h = headers(edges)
      const sorted = [...h].sort()
      expect(h).toEqual(sorted)
    })

    it('should return DependencyEdge objects with correct fields', () => {
      const tree = makeProgram([
        createNode('cpp:print', {}, { values: [createNode('cpp:var_ref', { name: 'x' })] }),
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

// 🔴 **補丁器往程式碼裡加兩種東西，而樹裡本來只回得來一種**（2026-09-02）。
//
//    使用者：「為何 `using namespace std;` 不見了？」——那一句是補丁器加的，
//    從來沒有被放回樹裡，於是下一次「從真相重新投影」就沒有它。
//
// > **一個只存在於某一個投影上的東西，在下一次重新投影的時候就會消失。**
describe('autoIncludeNodes：using 那一句也要回到樹裡', () => {
  const edges = [{ header: '<iostream>', directive: '#include <iostream>' }] as never[]

  it('using 風格 → 引入之後接一顆 cpp:using_namespace', () => {
    const nodes = autoIncludeNodes(edges, 'using')
    expect(nodes.map((n) => n.componentId)).toEqual(['cpp:include', 'cpp:using_namespace'])
    expect(nodes[1].properties.ns).toBe('std')
  })

  it('explicit 風格 → 只有引入（std:: 是寫在用的地方，不是一句宣告）', () => {
    expect(autoIncludeNodes(edges, 'explicit').map((n) => n.componentId)).toEqual(['cpp:include'])
  })

  it('沒有任何相依 → 一顆都不補（連 using 都不補）', () => {
    expect(autoIncludeNodes([], 'using')).toEqual([])
  })
})
