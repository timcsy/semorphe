import { describe, it, expect } from 'vitest'
import { BlockExtractorRegistry } from '../../../src/core/registry/block-extractor-registry'
import type { BlockExtractorFn } from '../../../src/core/registry/block-extractor-registry'
import { createNode } from '../../../src/core/semantic-tree'
import { createCppExtractorRegistry } from '../../../src/languages/cpp/extractors/register'

describe('BlockExtractorRegistry', () => {
  it('should register and retrieve extractors', () => {
    const registry = new BlockExtractorRegistry()
    const fn: BlockExtractorFn = () => createNode('test', {})
    registry.register('u_test', fn)
    expect(registry.get('u_test')).toBe(fn)
    expect(registry.has('u_test')).toBe(true)
    expect(registry.has('u_nonexistent')).toBe(false)
  })

  it('should return null for unregistered types', () => {
    const registry = new BlockExtractorRegistry()
    expect(registry.get('not_registered')).toBeNull()
  })

  it('should report size correctly', () => {
    const registry = new BlockExtractorRegistry()
    expect(registry.size).toBe(0)
    registry.register('a', () => createNode('test', {}))
    registry.register('b', () => createNode('test', {}))
    expect(registry.size).toBe(2)
  })
})

describe('C++ ExtractorRegistry — remaining hand-written extractors', () => {
  it('should have extractors for blocks that require special logic', () => {
    const registry = createCppExtractorRegistry()
    // These blocks need hand-written extractors due to complex logic
    // that cannot be expressed as declarative dynamicRules:
    const specialTypes = [
      'u_var_declare',     // multi-variable with items array
      'u_if',              // elseif chain flattening
      'u_if_else',         // same as u_if
      'u_input',           // select mode fallback (SEL_0/NAME)
      'u_input_expr',      // same as u_input
      'c_comment_doc',     // flat property model for params
      'c_var_declare_expr', // expression version of var_declare
    ]
    for (const type of specialTypes) {
      expect(registry.has(type), `Missing extractor for ${type}`).toBe(true)
    }
  })

  it('should have correct number of remaining extractors', () => {
    const registry = createCppExtractorRegistry()
    // 7 blocks still use hand-written extractors; the rest use PatternExtractor + dynamicRules
    expect(registry.size).toBe(7)
  })
})
